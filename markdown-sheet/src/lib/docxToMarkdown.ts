import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { writeTextFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";

export interface ConvertResult {
  mdPath: string;
}

/**
 * Convert a .docx file (as Uint8Array) to Markdown.
 * Images are extracted and saved to `{docxName}_images/` next to the docx.
 * Returns the path of the generated .md file.
 */
export async function docxToMarkdown(
  data: Uint8Array,
  docxPath: string
): Promise<ConvertResult> {
  // Derive output paths
  const dir = docxPath.replace(/[\\/][^\\/]*$/, "");
  const baseName = docxPath.replace(/^.*[\\/]/, "").replace(/\.docx$/i, "");
  const imagesDir = `${dir}/${baseName}_images`;
  const mdPath = `${dir}/${baseName}.md`;

  // Collect images during conversion
  const images: { name: string; data: Uint8Array }[] = [];
  let imageIndex = 0;

  const result = await mammoth.convertToHtml(
    { arrayBuffer: data.buffer as ArrayBuffer },
    {
      convertImage: mammoth.images.imgElement((image) => {
        imageIndex++;
        const ext = (image.contentType?.split("/")[1] || "png").replace("jpeg", "jpg");
        const name = `image${imageIndex}.${ext}`;

        return image.read("base64").then((base64Data) => {
          const binary = atob(base64Data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          images.push({ name, data: bytes });
          return { src: `__IMG_PLACEHOLDER_${imageIndex}__` };
        });
      }),
    }
  );

  // Convert HTML to Markdown
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  turndown.use(gfm);

  let markdown = turndown.turndown(result.value);

  // Replace image placeholders with relative paths
  for (let i = 1; i <= images.length; i++) {
    const placeholder = `__IMG_PLACEHOLDER_${i}__`;
    const relativePath = `${baseName}_images/${images[i - 1].name}`;
    markdown = markdown.split(placeholder).join(relativePath);
  }

  // Save images if any
  if (images.length > 0) {
    await mkdir(imagesDir, { recursive: true });
    for (const img of images) {
      await writeFile(`${imagesDir}/${img.name}`, img.data);
    }
  }

  // Save .md file
  await writeTextFile(mdPath, markdown);

  return { mdPath };
}
