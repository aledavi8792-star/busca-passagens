import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchFlights } from "@/lib/searchFlights";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  origin: z.string().trim().min(3).max(10).transform((s) => s.toUpperCase()),
  destination: z.string().trim().min(3).max(10).transform((s) => s.toUpperCase()),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flexDays: z.coerce.number().int().min(0).max(3).default(0),
  nearbyAirports: z.coerce.boolean().default(false),
  adults: z.coerce.number().int().min(1).max(9).default(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido (JSON esperado)." }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros de busca inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.origin === parsed.data.destination) {
    return NextResponse.json({ error: "Origem e destino não podem ser iguais." }, { status: 400 });
  }

  try {
    const result = await searchFlights(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erro inesperado na busca de voos:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao buscar voos. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
