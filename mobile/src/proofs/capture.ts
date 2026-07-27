// Captura de provas: câmera, galeria ou arquivo qualquer.
//
// Toda imagem é reduzida antes de encostar no banco (decisão D15): 1920px no maior lado,
// JPEG 85%. Uma foto de celular moderno tem 4-8 MB; assim vira ~300 KB, o que muda tudo
// para uma sincronização por Wi-Fi doméstico — e o limite do servidor é 25 MB por arquivo.
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { guardar, pastaDeProvas } from "./files";

export { apagarOriginal } from "./files";

export const MAX_LADO = 1920;
export const QUALIDADE = 0.85;
export const LADO_MINIATURA = 256;
export const LIMITE_BYTES = 25 * 1024 * 1024; // o mesmo do multer no servidor

export type ProvaCapturada = {
  clientUuid: string;
  /** arquivo cheio, que vai subir e depois é apagado do aparelho */
  uri: string;
  /** miniatura que fica para sempre (poucos KB), para a prova aparecer offline */
  thumbUri: string | null;
  originalName: string;
  mimeType: string;
  size: number;
};

async function processarImagem(uri: string, nomeOriginal: string): Promise<ProvaCapturada> {
  const clientUuid = Crypto.randomUUID();

  const reduzida = await (await ImageManipulator.manipulate(uri).resize({ width: MAX_LADO }).renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALIDADE,
  });

  const arquivo = guardar(reduzida.uri, pastaDeProvas("provas"), `${clientUuid}.jpg`);

  // miniatura separada: quando o arquivo cheio subir e for apagado, ela continua aqui
  let thumbUri: string | null = null;
  try {
    const mini = await (
      await ImageManipulator.manipulate(arquivo.uri).resize({ width: LADO_MINIATURA }).renderAsync()
    ).saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    thumbUri = guardar(mini.uri, pastaDeProvas("miniaturas"), `${clientUuid}.jpg`).uri;
  } catch {
    // sem miniatura o app mostra um ícone de arquivo; não é motivo para perder a prova
  }

  return {
    clientUuid,
    uri: arquivo.uri,
    thumbUri,
    originalName: nomeOriginal,
    mimeType: "image/jpeg",
    size: arquivo.size ?? 0,
  };
}

export async function tirarFoto(): Promise<ProvaCapturada | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) return null;

  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;

  const nome = `prova-${new Date().toISOString().slice(0, 10)}.jpg`;
  return processarImagem(r.assets[0].uri, nome);
}

export async function escolherDaGaleria(): Promise<ProvaCapturada | null> {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return null;

  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;

  const asset = r.assets[0];
  return processarImagem(asset.uri, asset.fileName ?? "prova.jpg");
}

/** Arquivo qualquer (PDF, zip, print salvo). Vai como está — só imagem é reduzida. */
export async function escolherArquivo(): Promise<ProvaCapturada | null> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;

  const asset = r.assets[0];
  const clientUuid = Crypto.randomUUID();
  const extensao = (asset.name.split(".").pop() ?? "bin").toLowerCase();

  if ((asset.mimeType ?? "").startsWith("image/")) {
    return processarImagem(asset.uri, asset.name);
  }

  const arquivo = guardar(asset.uri, pastaDeProvas("provas"), `${clientUuid}.${extensao}`);
  return {
    clientUuid,
    uri: arquivo.uri,
    thumbUri: null,
    originalName: asset.name,
    mimeType: asset.mimeType ?? "application/octet-stream",
    size: arquivo.size ?? asset.size ?? 0,
  };
}

