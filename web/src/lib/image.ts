// Reduz a foto escolhida antes de guardar.
//
// O avatar saiu do localStorage e virou Setting no banco (para o celular também
// enxergar), e ele viaja no pull de sincronização. Uma foto de câmera em base64 tem
// megabytes; 256px em JPEG resolve o mesmo problema visual em ~20 KB.
export async function downscaleToDataUrl(file: File, max = 256, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
