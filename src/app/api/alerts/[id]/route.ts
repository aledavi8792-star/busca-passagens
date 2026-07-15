import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/alerts/[id]">) {
  const { id } = await ctx.params;
  await prisma.alert.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/alerts/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const active = typeof body.active === "boolean" ? body.active : undefined;
  if (active === undefined) {
    return NextResponse.json({ error: "Campo 'active' (boolean) é obrigatório." }, { status: 400 });
  }
  const alert = await prisma.alert.update({ where: { id }, data: { active } }).catch(() => null);
  if (!alert) return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
  return NextResponse.json({ alert });
}
