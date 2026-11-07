// Reuse the existing PESTPRINT website's vector leaf mark for Android branding.
const fs = require('node:fs/promises');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const brandRoot = path.join(projectRoot, 'assets/brand');
  const source = await fs.readFile(path.join(brandRoot, 'pestprint-mark.svg'), 'utf8');
  const cacheRoot = path.join(projectRoot, '.expo/brand');
  await fs.mkdir(cacheRoot, { recursive: true });
  for (const [name, svg] of [
    ['pestprint-foreground', source],
    ['pestprint-icon', source.replace('<!-- background -->', '<rect width="1024" height="1024" fill="#07852F"/>').replace('translate(224 224) scale(12)', 'translate(176 176) scale(14)')],
  ]) {
    const vectorPath = path.join(cacheRoot, `${name}.svg`);
    await fs.writeFile(vectorPath, svg);
    const generated = new Resvg(svg).render().asPng();
    await fs.writeFile(path.join(brandRoot, `${name}.png`), generated);
  }
  console.log('Generated PESTPRINT Android icons from the existing vector mark.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
