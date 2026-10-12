export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export async function api(
  path,
  { method = "GET", data, csrf, token, timeout = 15000 } = {},
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "A API não está disponível. Execute o servidor Node ou publique com as funções da Vercel.",
      );
    }
    if (!response.ok) {
      const error = new Error(result.error || "Não foi possível concluir.");
      error.status = response.status;
      error.code = result.code;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "A solicitação demorou mais que o esperado. Confira sua conexão e tente novamente.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export function saveOrderAccess(order) {
  try {
    const list = JSON.parse(localStorage.getItem("pulse-orders-v1") || "[]");
    const items = Array.isArray(list) ? list : [];
    const next = [
      {
        id: order.orderId,
        token: order.accessToken,
        createdAt: new Date().toISOString(),
      },
      ...items.filter((i) => i.id !== order.orderId),
    ].slice(0, 30);
    localStorage.setItem("pulse-orders-v1", JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
export function orderAccess(id) {
  try {
    const data = JSON.parse(localStorage.getItem("pulse-orders-v1") || "[]");
    return Array.isArray(data) ? data.find((i) => i.id === id)?.token : null;
  } catch {
    return null;
  }
}
