import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchFlights } from "@/lib/searchFlights";
import { sendPriceDropEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hit once a day by Vercel Cron (see vercel.json). Re-runs every active
// alert's search, records a price-history point, and emails when the best
// price found drops at/below the alert's target. Guard with CRON_SECRET so
// this can't be triggered by anyone who finds the URL.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const alerts = await prisma.alert.findMany({ where: { active: true } });
  const summary: Array<{ alertId: string; bestPriceBRL: number | null; emailed: boolean }> = [];

  for (const alert of alerts) {
    try {
      const result = await searchFlights({
        origin: alert.origin,
        destination: alert.destination,
        departureDate: alert.departureDate,
        returnDate: alert.returnDate ?? undefined,
        flexDays: alert.flexDays,
        nearbyAirports: alert.nearbyAirports,
        adults: alert.adults,
      });

      const best = result.offers[0] ?? null;
      const bestPriceBRL = best?.priceBRL ?? null;

      if (best) {
        await prisma.priceHistory.create({
          data: {
            alertId: alert.id,
            bestPriceBrl: best.priceBRL,
            departureDate: best.departureDate,
            returnDate: best.returnDate,
            carrierCode: best.carrierCodes[0],
            raw: JSON.stringify({ id: best.id, isMock: best.isMock }),
          },
        });
      }

      let emailed = false;
      const shouldNotify =
        bestPriceBRL !== null &&
        bestPriceBRL <= alert.targetPriceBrl &&
        (!alert.notifiedAt || hoursSince(alert.notifiedAt) > 24);

      if (shouldNotify && bestPriceBRL !== null) {
        const emailResult = await sendPriceDropEmail({
          to: alert.email,
          origin: alert.origin,
          destination: alert.destination,
          departureDate: best!.departureDate,
          returnDate: best!.returnDate,
          bestPriceBRL,
          targetPriceBrl: alert.targetPriceBrl,
        });
        emailed = emailResult.sent;
      }

      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: new Date(),
          lastBestPrice: bestPriceBRL ?? undefined,
          notifiedAt: shouldNotify ? new Date() : undefined,
        },
      });

      summary.push({ alertId: alert.id, bestPriceBRL, emailed });
    } catch (err) {
      console.error(`Erro ao checar alerta ${alert.id}:`, err);
      summary.push({ alertId: alert.id, bestPriceBRL: null, emailed: false });
    }
  }

  return NextResponse.json({ checked: alerts.length, summary });
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}
