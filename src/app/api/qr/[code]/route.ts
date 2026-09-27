import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkoutUrl } from "@/lib/urls";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { code } = await params;
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const url = checkoutUrl(code);

  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(svg, {
      headers: { "content-type": "image/svg+xml", "content-disposition": `attachment; filename="qr-${code}.svg"` },
    });
  }
  const png = await QRCode.toBuffer(url, { width: 1200, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "content-disposition": `attachment; filename="qr-${code}.png"` },
  });
}
