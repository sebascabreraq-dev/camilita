// Uso:  node generar-fotos.js   (en la carpeta del proyecto)
// Lee fotos/inicio y fotos/album y reescribe fotos.js con los nombres de archivo.
const fs = require("fs"), path = require("path");
const ext = /\.(jpe?g|png|webp|gif|avif|heic)$/i;
const leer = c => fs.existsSync(path.join("fotos", c))
  ? fs.readdirSync(path.join("fotos", c)).filter(f => ext.test(f)).sort((a, b) => a.localeCompare(b, "es", { numeric: true })) : [];
const lista = a => a.length ? "\n" + a.map(f => `    ${JSON.stringify(f)}`).join(",\n") + "\n  " : "";
const antes = fs.readFileSync("fotos.js", "utf8").split("window.FOTOS")[0];
fs.writeFileSync("fotos.js", `${antes}window.FOTOS = {\n  inicio: [${lista(leer("inicio"))}],\n  album: [${lista(leer("album"))}]\n};\n`);
console.log(`Listo: ${leer("inicio").length} fotos en inicio, ${leer("album").length} en album.`);