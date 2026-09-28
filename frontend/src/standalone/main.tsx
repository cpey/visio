// Standalone Visio app, served at /visio-app. Logs in through Home Assistant's own
// login page (OAuth), then shows only Visio full screen. Reuses the panel's <App>
// by building the same `hass` shape from a direct WebSocket connection.

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createConnection,
  ERR_INVALID_AUTH,
  getAuth,
  getUser,
  subscribeEntities,
  type Auth,
  type AuthData,
  type Connection,
  type HassEntities,
  type HassUser,
} from "home-assistant-js-websocket";
import { App } from "../App";
import { styles } from "../styles";
import type { Hass, HassEntity } from "../types";

const TOKEN_KEY = "visio-auth";

function loadTokens(): Promise<AuthData | null> {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return Promise.resolve(raw ? (JSON.parse(raw) as AuthData) : null);
  } catch {
    return Promise.resolve(null);
  }
}

function saveTokens(data: AuthData | null) {
  try {
    if (data) localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode / blocked storage: the user logs in again next visit.
  }
}

/** Drop the OAuth callback parameters, keep the rest (e.g. ?layout=tv). */
function cleanCallbackUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth_callback")) return;
  ["auth_callback", "code", "state"].forEach((p) => url.searchParams.delete(p));
  window.history.replaceState(null, "", url.toString());
}

async function connect(): Promise<{ auth: Auth; connection: Connection }> {
  const options = { hassUrl: window.location.origin, loadTokens, saveTokens };
  let auth: Auth;
  try {
    auth = await getAuth(options);
  } catch (err) {
    if (err !== ERR_INVALID_AUTH) throw err;
    // Stored tokens were revoked: start a fresh login.
    saveTokens(null);
    auth = await getAuth(options);
  }
  cleanCallbackUrl();
  const connection = await createConnection({ auth });
  return { auth, connection };
}

function Standalone({ auth, connection }: { auth: Auth; connection: Connection }) {
  const [states, setStates] = useState<HassEntities | null>(null);
  const [user, setUser] = useState<HassUser | null>(null);

  useEffect(() => subscribeEntities(connection, setStates), [connection]);
  useEffect(() => {
    getUser(connection).then(setUser);
  }, [connection]);

  const hass = useMemo<Hass | null>(() => {
    if (!states || !user) return null;
    return {
      states: states as unknown as Record<string, HassEntity>,
      user,
      connection,
      callWS: <T,>(msg: Record<string, unknown>) =>
        connection.sendMessagePromise<T>(msg as { type: string }),
      hassUrl: (path = "") => new URL(path, auth.data.hassUrl).toString(),
    };
  }, [states, user, connection, auth]);

  if (!hass) return <div className="empty">Loading…</div>;

  const logout = async () => {
    try {
      await auth.revoke();
    } finally {
      saveTokens(null);
      window.location.reload();
    }
  };

  return (
    <App
      hass={hass}
      pageChrome
      menuItems={[
        ...(user?.is_admin ? [{ label: "Home Assistant", icon: "home" as const, href: "/" }] : []),
        { label: "Log out", icon: "logout" as const, onClick: logout },
      ]}
    />
  );
}

async function main() {
  const style = document.createElement("style");
  // Panel styles target :host (shadow DOM); here they apply to the page root.
  style.textContent = styles.replace(":host {", ":root, body {");
  document.head.append(style);

  const mount = document.getElementById("root")!;
  const root = createRoot(mount);
  try {
    const { auth, connection } = await connect();
    root.render(<Standalone auth={auth} connection={connection} />);
  } catch (err) {
    root.render(<div className="empty">⚠ Could not connect to Home Assistant ({String(err)})</div>);
  }
}

main();
