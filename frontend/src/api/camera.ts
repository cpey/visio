// Camera access through Home Assistant only: snapshot proxy and WebRTC signalling.

import type { Hass } from "../types";

/** Snapshot URL for a camera entity, with a cache-busting parameter. */
export function snapshotUrl(hass: Hass, entityId: string, bust: number): string | null {
  const picture = hass.states[entityId]?.attributes.entity_picture;
  if (!picture) return null;
  const sep = picture.includes("?") ? "&" : "?";
  return hass.hassUrl(`${picture}${sep}t=${bust}`);
}

interface Capabilities {
  frontend_stream_types: string[];
}

export async function supportsWebRtc(hass: Hass, entityId: string): Promise<boolean> {
  try {
    const caps = await hass.callWS<Capabilities>({ type: "camera/capabilities", entity_id: entityId });
    return caps.frontend_stream_types.includes("web_rtc");
  } catch {
    return false;
  }
}

type WebRtcEvent =
  | { type: "session"; session_id: string }
  | { type: "answer"; answer: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { type: "error"; code: string; message: string };

export interface LiveSession {
  close(): void;
}

/**
 * Start a receive-only WebRTC session via HA's camera/webrtc/* WebSocket API
 * (served by HA's built-in go2rtc or the camera integration itself, e.g. Ring).
 */
export async function startWebRtc(
  hass: Hass,
  entityId: string,
  onStream: (stream: MediaStream) => void,
  onFailure: (reason: string) => void,
): Promise<LiveSession> {
  const clientConfig = await hass.callWS<{ configuration: RTCConfiguration; dataChannel?: string }>({
    type: "camera/webrtc/get_client_config",
    entity_id: entityId,
  });

  const pc = new RTCPeerConnection(clientConfig.configuration);
  if (clientConfig.dataChannel) pc.createDataChannel(clientConfig.dataChannel);
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  const stream = new MediaStream();
  pc.ontrack = (ev) => {
    stream.addTrack(ev.track);
    onStream(stream);
  };

  let closed = false;
  let sessionId: string | null = null;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const sendCandidate = (candidate: RTCIceCandidateInit) =>
    hass
      .callWS({ type: "camera/webrtc/candidate", entity_id: entityId, session_id: sessionId, candidate })
      .catch(() => undefined);

  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    const candidate = ev.candidate.toJSON();
    if (sessionId) sendCandidate(candidate);
    else pendingCandidates.push(candidate);
  };

  const fail = (reason: string) => {
    if (closed) return;
    session.close();
    onFailure(reason);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      fail(`connection ${pc.connectionState}`);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const unsubscribe = await hass.connection.subscribeMessage<WebRtcEvent>(
    async (event) => {
      switch (event.type) {
        case "session":
          sessionId = event.session_id;
          pendingCandidates.splice(0).forEach(sendCandidate);
          break;
        case "answer":
          await pc.setRemoteDescription({ type: "answer", sdp: event.answer });
          break;
        case "candidate":
          await pc.addIceCandidate(event.candidate).catch(() => undefined);
          break;
        case "error":
          fail(`${event.code}: ${event.message}`);
          break;
      }
    },
    { type: "camera/webrtc/offer", entity_id: entityId, offer: offer.sdp },
  );

  const session: LiveSession = {
    close() {
      if (closed) return;
      closed = true;
      unsubscribe().catch(() => undefined);
      pc.close();
    },
  };
  return session;
}
