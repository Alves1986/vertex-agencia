import { decryptProviderKey } from "../aiAds/crypto";
import { buildMetaOutboundRequest, buildTwilioOutboundRequest, type MetaChannelConfig, type TwilioChannelConfig, type WhatsAppProvider } from "./providers";

type DispatchCandidate = {
  provider: WhatsAppProvider;
  encryptedConfig: string;
  destination: string;
  body: string;
};

type ProviderResponse = {
  providerMessageId: string;
  providerPayload: Record<string, unknown>;
};

function readStoredConfig<T>(encryptedConfig: string): T {
  try {
    return JSON.parse(decryptProviderKey(encryptedConfig)) as T;
  } catch {
    throw new Error("A configuração cifrada do canal não pôde ser lida. Reconfigure o canal antes de enviar.");
  }
}

async function readResponsePayload(response: Response) {
  const raw = await response.text();
  if (!raw) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { response: raw.slice(0, 500) };
  } catch {
    return { response: raw.slice(0, 500) };
  }
}

/** Executa somente a chamada oficial já autorizada; a autorização e a idempotência pertencem à camada de dados. */
export async function dispatchApprovedWhatsAppMessage(candidate: DispatchCandidate, fetcher: typeof fetch = globalThis.fetch): Promise<ProviderResponse> {
  const config = candidate.provider === "meta_cloud"
    ? readStoredConfig<MetaChannelConfig>(candidate.encryptedConfig)
    : readStoredConfig<TwilioChannelConfig>(candidate.encryptedConfig);
  const request = candidate.provider === "meta_cloud"
    ? buildMetaOutboundRequest(config as MetaChannelConfig, candidate.destination, candidate.body)
    : buildTwilioOutboundRequest(config as TwilioChannelConfig, candidate.destination, candidate.body);
  const response = await fetcher(request.endpoint, { method: "POST", headers: request.headers, body: request.body });
  const payload = await readResponsePayload(response);
  if (!response.ok) throw new Error(`O provedor recusou a entrega (${response.status}).`);
  const providerMessageId = candidate.provider === "meta_cloud"
    ? (Array.isArray(payload.messages) && typeof payload.messages[0] === "object" && payload.messages[0] && typeof (payload.messages[0] as Record<string, unknown>).id === "string" ? (payload.messages[0] as Record<string, string>).id : null)
    : typeof payload.sid === "string" ? payload.sid : null;
  if (!providerMessageId) throw new Error("O provedor aceitou a requisição, mas não retornou um identificador de mensagem rastreável.");
  return { providerMessageId, providerPayload: payload };
}

export function isWhatsAppExternalDeliveryEnabled() {
  return process.env.WHATSAPP_OUTBOUND_ENABLED === "true";
}
