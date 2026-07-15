import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const alertSchema = z.object({
  origin: z.string().trim().min(3).max(10).transform((s) => s.toUpperCase()),
  destination: z.string().trim().min(3).max(10).transform((s) => s.toUpperCase()),
  isCombined: z.boolean().default(false),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flexDays: z.coerce.number().int().min(0).max(3).default(3),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  nearbyAirports: z.coerce.boolean().default(false),
  targetPriceBrl: z.coerce.number().positive(),
  email: z.string().email(),
});

export async function GET() {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ alerts });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido (JSON esperado)." }, { status: 400 });
  }

  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do alerta inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const alert = await prisma.alert.create({ data: parsed.data });
  return NextResponse.json({ alert }, { status: 201 });
}
