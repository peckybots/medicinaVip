import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESEARCH_DIR = path.join(PROJECT_ROOT, 'research');
const OUTPUT_BASE = path.join(PROJECT_ROOT, 'src', 'content', 'clinicas');

// Mapping from Spanish text to enum values
const ESPECIALIDAD_MAP = {
  // oncologia
  'oncolog': 'oncologia',
  // cardiologia
  'cardiolog': 'cardiologia',
  'cardiovascular': 'cardiologia',
  'cardio': 'cardiologia',
  // neurologia
  'neurolog': 'neurologia',
  'neurocirugía': 'neurologia',
  'neurocirugia': 'neurologia',
  // cirugia robotica (must check before cirugia)
  'cirugía robótica': 'cirugia-robotica',
  'cirugia robotica': 'cirugia-robotica',
  'robótica': 'cirugia-robotica',
  'robotica': 'cirugia-robotica',
  // cirugia
  'cirugía general': 'cirugia',
  'cirugia general': 'cirugia',
  'cirugía': 'cirugia',
  'cirugia': 'cirugia',
  // estetica
  'estética': 'estetica',
  'estetica': 'estetica',
  'cosmética': 'estetica',
  'cosmetica': 'estetica',
  'cirugía plástica': 'estetica',
  'cirugia plastica': 'estetica',
  // checkup
  'checkup': 'checkup',
  'check-up': 'checkup',
  'check up': 'checkup',
  'chequeo': 'checkup',
  'ejecutivo': 'checkup',
  // fertilidad
  'fertilidad': 'fertilidad',
  'reproducción': 'fertilidad',
  'reproduccion': 'fertilidad',
  'fiv': 'fertilidad',
  'reproducción asistida': 'fertilidad',
  // ortopedia
  'ortopedia': 'ortopedia',
  'traumatolog': 'ortopedia',
  'columna': 'ortopedia',
  'columna vertebral': 'ortopedia',
  // trasplantes
  'trasplante': 'trasplantes',
  'trasplantes': 'trasplantes',
  // neonatologia
  'neonatolog': 'neonatologia',
  // pediatria
  'pediatr': 'pediatria',
  // geriatria
  'geriatr': 'geriatria',
  // oftalmologia
  'oftalmolog': 'oftalmologia',
  'ojos': 'oftalmologia',
  // dermatologia
  'dermatolog': 'dermatologia',
  // odontologia
  'odontolog': 'odontologia',
  'dental': 'odontologia',
  'dentist': 'odontologia',
  // psiquiatria
  'psiquiatr': 'psiquiatria',
  'psicolog': 'psiquiatria',
  'salud mental': 'psiquiatria',
  // rehabilitacion
  'rehabilitac': 'rehabilitacion',
  'fisioterapia': 'rehabilitacion',
  'fisiatría': 'rehabilitacion',
  'fisiatra': 'rehabilitacion',
  // urgencias
  'urgencias': 'urgencias',
  'emergencias': 'urgencias',
  // medicina-interna
  'medicina interna': 'medicina-interna',
  'medicina general': 'medicina-interna',
  // gastroenterologia
  'gastroenterolog': 'gastroenterologia',
  'gastro': 'gastroenterologia',
  // neumologia
  'neumolog': 'neumologia',
  'pulmon': 'neumologia',
  'pulmón': 'neumologia',
  'respirator': 'neumologia',
  // urologia
  'urolog': 'urologia',
  // ginecologia
  'ginecolog': 'ginecologia',
  'obstétric': 'ginecologia',
  'obstetric': 'ginecologia',
  'maternidad': 'ginecologia',
  // endocrinologia
  'endocrinolog': 'endocrinologia',
  'diabetes': 'endocrinologia',
  // reumatologia
  'reumatolog': 'reumatologia',
  // hematologia
  'hematolog': 'hematologia',
  // infectologia
  'infectolog': 'infectologia',
  'infecciosas': 'infectologia',
  // hepatologia
  'hepatolog': 'hepatologia',
  'hígado': 'hepatologia',
  'higado': 'hepatologia',
};

function normalizeSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeEspecialidad(raw) {
  const lower = raw.toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Try exact matches first (longest to shortest to prefer specifics)
  const sortedKeys = Object.keys(ESPECIALIDAD_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const normKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(normKey)) {
      return ESPECIALIDAD_MAP[key];
    }
  }

  return 'general';
}

function parseEspecialidades(rawStr) {
  if (!rawStr) return ['general'];
  const parts = rawStr.split(',').map(s => s.trim()).filter(Boolean);
  const results = new Set();
  for (const part of parts) {
    results.add(normalizeEspecialidad(part));
  }
  return Array.from(results);
}

function escapeYaml(str) {
  if (!str) return '""';
  // If contains quotes or special chars, use double-quoted with escaped quotes
  const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseClinicBlock(lines, pais) {
  const clinic = {
    pais,
    featured: false,
    draft: false,
  };

  for (const line of lines) {
    const match = line.match(/^-\s+\*\*([^:]+):\*\*\s*(.*)/);
    if (!match) continue;
    const field = match[1].trim().toLowerCase();
    const value = match[2].trim();

    switch (field) {
      case 'ciudad': clinic.ciudad = value; break;
      case 'slug': clinic.slug = value; break;
      case 'especialidades': clinic.especialidades = parseEspecialidades(value); break;
      case 'descripcion':
      case 'descripción': clinic.descripcion = value; break;
      case 'direccion':
      case 'dirección': clinic.direccion = value; break;
      case 'web': clinic.web = value; break;
      case 'telefono':
      case 'teléfono': clinic.telefono = value; break;
      case 'email': clinic.email = value; break;
      case 'certificaciones': {
        clinic.certificaciones = value.split(',').map(s => s.trim()).filter(Boolean);
        break;
      }
      case 'medicos_destacados':
      case 'médicos destacados':
      case 'medicos destacados': {
        clinic.medicos_destacados = value.split(',').map(s => s.trim()).filter(Boolean);
        break;
      }
      case 'fundacion':
      case 'fundación': {
        const num = parseInt(value, 10);
        if (!isNaN(num)) clinic.fundacion = num;
        break;
      }
      case 'camas': {
        const num = parseInt(value, 10);
        if (!isNaN(num)) clinic.camas = num;
        break;
      }
      case 'imagen': clinic.imagen = value; break;
      case 'featured': clinic.featured = value.toLowerCase() === 'true'; break;
      case 'draft': clinic.draft = value.toLowerCase() === 'true'; break;
    }
  }

  return clinic;
}

function buildFrontmatter(clinic) {
  const lines = [];
  lines.push('---');
  lines.push(`name: ${escapeYaml(clinic.name)}`);
  lines.push(`slug: ${escapeYaml(clinic.slug)}`);
  lines.push(`pais: ${escapeYaml(clinic.pais)}`);
  lines.push(`ciudad: ${escapeYaml(clinic.ciudad || '')}`);

  const specs = (clinic.especialidades || ['general']);
  lines.push(`especialidades: [${specs.map(s => `"${s}"`).join(', ')}]`);

  lines.push(`descripcion: ${escapeYaml(clinic.descripcion || '')}`);

  if (clinic.direccion) lines.push(`direccion: ${escapeYaml(clinic.direccion)}`);
  if (clinic.telefono) lines.push(`telefono: ${escapeYaml(clinic.telefono)}`);
  if (clinic.web) lines.push(`web: ${escapeYaml(clinic.web)}`);
  if (clinic.email) lines.push(`email: ${escapeYaml(clinic.email)}`);

  if (clinic.certificaciones && clinic.certificaciones.length > 0) {
    lines.push(`certificaciones: [${clinic.certificaciones.map(s => `"${s}"`).join(', ')}]`);
  }
  if (clinic.medicos_destacados && clinic.medicos_destacados.length > 0) {
    lines.push(`medicos_destacados: [${clinic.medicos_destacados.map(s => `"${s}"`).join(', ')}]`);
  }
  if (clinic.fundacion) lines.push(`fundacion: ${clinic.fundacion}`);
  if (clinic.camas) lines.push(`camas: ${clinic.camas}`);
  if (clinic.imagen) lines.push(`imagen: ${escapeYaml(clinic.imagen)}`);

  lines.push(`featured: ${clinic.featured}`);
  lines.push(`draft: ${clinic.draft}`);
  lines.push('---');
  lines.push('');
  lines.push(clinic.descripcion || '');
  lines.push('');

  return lines.join('\n');
}

function processFile(filePath, pais) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rawLines = content.split('\n');

  const clinics = [];
  let currentName = null;
  let currentLines = [];

  for (const line of rawLines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      if (currentName) {
        clinics.push({ name: currentName, lines: currentLines });
      }
      currentName = h2Match[1].trim();
      currentLines = [];
    } else if (currentName) {
      currentLines.push(line);
    }
  }
  if (currentName) {
    clinics.push({ name: currentName, lines: currentLines });
  }

  return clinics.map(c => {
    const clinic = parseClinicBlock(c.lines, pais);
    clinic.name = c.name;
    if (!clinic.slug) {
      clinic.slug = normalizeSlug(c.name);
    }
    return clinic;
  });
}

// Main
let totalWritten = 0;
let totalSkipped = 0;

const researchFiles = fs.readdirSync(RESEARCH_DIR).filter(f => f.endsWith('.md'));

for (const filename of researchFiles) {
  const pais = filename.replace('.md', '');
  const filePath = path.join(RESEARCH_DIR, filename);
  const outDir = path.join(OUTPUT_BASE, pais);

  fs.mkdirSync(outDir, { recursive: true });

  let clinics;
  try {
    clinics = processFile(filePath, pais);
  } catch (err) {
    console.error(`[ERROR] Failed to parse ${filename}: ${err.message}`);
    continue;
  }

  for (const clinic of clinics) {
    const outPath = path.join(outDir, `${clinic.slug}.md`);

    if (fs.existsSync(outPath)) {
      console.log(`[${pais}] SKIP (exists): ${clinic.slug}`);
      totalSkipped++;
      continue;
    }

    const content = buildFrontmatter(clinic);
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`[${pais}] ${clinic.slug} → ${outPath.replace(PROJECT_ROOT + '/', '')}`);
    totalWritten++;
  }
}

console.log(`\n✅ Done! Written: ${totalWritten}, Skipped: ${totalSkipped}`);
