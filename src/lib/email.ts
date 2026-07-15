import { Resend } from "resend";
import { formatBRL } from "@/lib/currency";

export async function sendPriceDropEmail(params: {
  to: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  bestPriceBRL: number;
  targetPriceBrl: number;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[alert] (email desabilitado, RESEND_API_KEY não configurada) ${params.origin}→${params.destination} ` +
        `caiu para ${formatBRL(params.bestPriceBRL)} (alvo: ${formatBRL(params.targetPriceBrl)})`
    );
    return { sent: false, reason: "RESEND_API_KEY não configurada" };
  }

  const resend = new Resend(apiKey);
  const from = process.env.ALERT_FROM_EMAIL || "alerts@yourdomain.com";
  const tripLabel = params.returnDate
    ? `${params.departureDate} → ${params.returnDate}`
    : `${params.departureDate} (só ida)`;

  try {
    await resend.emails.send({
      from,
      to: params.to,
      subject: `Preço caiu: ${params.origin} → ${params.destination} por ${formatBRL(params.bestPriceBRL)}`,
      html: `
        <p>O preço da sua busca salva caiu abaixo do alvo:</p>
        <ul>
          <li><strong>Rota:</strong> ${params.origin} → ${params.destination}</li>
          <li><strong>Datas:</strong> ${tripLabel}</li>
          <li><strong>Menor preço encontrado:</strong> ${formatBRL(params.bestPriceBRL)}</li>
          <li><strong>Seu alvo:</strong> ${formatBRL(params.targetPriceBrl)}</li>
        </ul>
        <p>Abra o buscador para ver e comprar a oferta.</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error("Falha ao enviar email de alerta:", err);
    return { sent: false, reason: "Falha ao enviar via Resend" };
  }
}
