#!/usr/bin/env node
/**
 * expand-clinics.cjs
 * Parses research/*.md files, applies filtering, deduplicates, and generates
 * new clinic .md files in src/content/clinicas/{pais}/
 */

const fs = require('fs');
const path = require('path');

const RESEARCH_DIR = path.join(__dirname, '../research');
const CONTENT_DIR = path.join(__dirname, '../src/content/clinicas');

// Target counts per country
const TARGETS = {
  'argentina': 500,
  'espana': 400,
  'colombia': 300,
  'mexico': 300,
  'chile': 200,
  'peru': 200,
  'ecuador': 80,
  'venezuela': 60,
  'bolivia': 50,
  'costa-rica': 50,
  'guatemala': 50,
  'panama': 50,
  'republica-dominicana': 40,
  'uruguay': 40,
  'puerto-rico': 40,
  'honduras': 35,
  'paraguay': 35,
  'el-salvador': 30,
  'nicaragua': 30,
  'cuba': 25,
  'estados-unidos': 200,
};

// Valid specialty enum values from schema
const VALID_ESPECIALIDADES = new Set([
  'oncologia', 'cardiologia', 'neurologia', 'cirugia', 'estetica',
  'checkup', 'fertilidad', 'ortopedia', 'trasplantes', 'neonatologia',
  'pediatria', 'geriatria', 'oftalmologia', 'dermatologia', 'odontologia',
  'psiquiatria', 'rehabilitacion', 'urgencias', 'medicina-interna', 'gastroenterologia',
  'neumologia', 'urologia', 'ginecologia', 'endocrinologia', 'reumatologia',
  'hematologia', 'infectologia', 'cirugia-robotica', 'hepatologia', 'general'
]);

// Map non-standard specialty names to valid ones
const SPECIALTY_MAP = {
  'cirugía': 'cirugia',
  'cirugía general': 'cirugia',
  'cirugía robótica': 'cirugia-robotica',
  'cirugia-general': 'cirugia',
  'cirugia-cardiovascular': 'cirugia',
  'cirugía cardiovascular': 'cirugia',
  'cirugia cardiovascular': 'cirugia',
  'cirugia-plastica': 'cirugia',
  'cirugía plástica': 'cirugia',
  'traumatología': 'ortopedia',
  'traumatologia': 'ortopedia',
  'traumatología y ortopedia': 'ortopedia',
  'traumatología-ortopedia': 'ortopedia',
  'cardiología': 'cardiologia',
  'cardiología intervencionista': 'cardiologia',
  'cardiologia-intervencionista': 'cardiologia',
  'oncología': 'oncologia',
  'oncología molecular': 'oncologia',
  'oncología pediátrica': 'oncologia',
  'neurología': 'neurologia',
  'neonatología': 'neonatologia',
  'pediatría': 'pediatria',
  'geriatría': 'geriatria',
  'oftalmología': 'oftalmologia',
  'dermatología': 'dermatologia',
  'odontología': 'odontologia',
  'psiquiatría': 'psiquiatria',
  'rehabilitación': 'rehabilitacion',
  'gastroenterología': 'gastroenterologia',
  'neumología': 'neumologia',
  'urología': 'urologia',
  'ginecología': 'ginecologia',
  'obstetricia': 'ginecologia',
  'ginecología y obstetricia': 'ginecologia',
  'maternidad': 'ginecologia',
  'endocrinología': 'endocrinologia',
  'reumatología': 'reumatologia',
  'hematología': 'hematologia',
  'infectología': 'infectologia',
  'hepatología': 'hepatologia',
  'medicina interna': 'medicina-interna',
  'medicina-general': 'general',
  'medicina general': 'general',
  'medicina familiar': 'general',
  'checkup ejecutivo': 'checkup',
  'check-up': 'checkup',
  'check up': 'checkup',
  'fertilidad': 'fertilidad',
  'fertilización in vitro': 'fertilidad',
  'reproducción asistida': 'fertilidad',
  'cirugía de mínima invasión': 'cirugia',
  'cirugia-minima-invasion': 'cirugia',
  'cirugía laparoscópica': 'cirugia',
  'diagnostico por imagenes': 'general',
  'diagnóstico por imágenes': 'general',
  'diagnóstico por imagen': 'general',
  'imágenes': 'general',
  'laboratorio': 'general',
  'urgencias médicas': 'urgencias',
  'emergencias': 'urgencias',
  'trasplante': 'trasplantes',
  'trasplantes de órganos': 'trasplantes',
  'con atención médica diaria y con especialidades y/o otras profesiones': 'general',
  'mediano riesgo con internación con cuidados especiales': 'general',
  'alta complejidad': 'general',
  'psicología': 'psiquiatria',
  'psicologia': 'psiquiatria',
  'salud mental': 'psiquiatria',
  'cirugía cardíaca': 'cirugia',
  'cirugía vascular': 'cirugia',
  'neurocirugía': 'neurologia',
  'neurocirugía': 'neurologia',
  'endoscopía': 'gastroenterologia',
  'endoscopia': 'gastroenterologia',
  'cardiología pediátrica': 'cardiologia',
  'cardiologia-pediatrica': 'cardiologia',
};

// Slugify: lowercase, remove accents, spaces to hyphens, remove non-alphanumeric
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Normalize a specialty string to a valid enum value or null
function normalizeSpecialty(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  
  // Direct match
  if (VALID_ESPECIALIDADES.has(lower)) return lower;
  
  // Map lookup
  if (SPECIALTY_MAP[lower]) return SPECIALTY_MAP[lower];
  
  // Partial match against valid set
  for (const valid of VALID_ESPECIALIDADES) {
    if (lower.includes(valid)) return valid;
  }
  
  // Slugified match
  const slugged = slugify(lower);
  if (VALID_ESPECIALIDADES.has(slugged)) return slugged;
  
  return null;
}

// Collect all existing slugs from content directory
function collectExistingSlugs() {
  const slugs = new Set();
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const slugMatch = content.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
        if (slugMatch) {
          slugs.add(slugMatch[1].trim());
        }
        // Also add filename-based slug
        const fileSlug = path.basename(entry.name, '.md');
        slugs.add(fileSlug);
      }
    }
  }
  
  walkDir(CONTENT_DIR);
  return slugs;
}

// Count existing files per country
function countExistingPerCountry() {
  const counts = {};
  if (!fs.existsSync(CONTENT_DIR)) return counts;
  const entries = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dir = path.join(CONTENT_DIR, entry.name);
      const files = getAllMdFiles(dir);
      counts[entry.name] = files.length;
    }
  }
  return counts;
}

function getAllMdFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMdFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Parse a research file into clinic objects
function parseResearchFile(country) {
  const filePath = path.join(RESEARCH_DIR, `${country}.md`);
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf8');
  const clinics = [];
  
  // Split by ## headers
  const sections = content.split(/\n(?=## )/);
  
  for (const section of sections) {
    if (!section.startsWith('## ') && !section.startsWith('# ')) continue;
    
    const lines = section.split('\n');
    const nameMatch = lines[0].match(/^## (.+)/);
    if (!nameMatch) continue;
    
    const name = nameMatch[1].trim();
    if (!name || name.startsWith('Clínicas Privadas') || name.startsWith('Clínicas —')) continue;
    
    const clinic = {
      name,
      pais: country,
      ciudad: '',
      slug: '',
      especialidades: [],
      descripcion: '',
      web: '',
      featured: false,
    };
    
    for (const line of lines.slice(1)) {
      const ciudadMatch = line.match(/^\s*-\s*\*\*ciudad:\*\*\s*(.+)/);
      const slugMatch = line.match(/^\s*-\s*\*\*slug:\*\*\s*(.+)/);
      const espMatch = line.match(/^\s*-\s*\*\*especialidades:\*\*\s*(.+)/);
      const descMatch = line.match(/^\s*-\s*\*\*descripcion:\*\*\s*(.+)/);
      const webMatch = line.match(/^\s*-\s*\*\*web:\*\*\s*(.+)/);
      const featuredMatch = line.match(/^\s*-\s*\*\*featured:\*\*\s*(.+)/);
      
      if (ciudadMatch) clinic.ciudad = ciudadMatch[1].trim();
      if (slugMatch) clinic.slug = slugMatch[1].trim();
      if (espMatch) {
        const rawSpecs = espMatch[1].split(',').map(s => s.trim());
        clinic.especialidades = rawSpecs
          .map(s => normalizeSpecialty(s))
          .filter(Boolean);
        // Deduplicate
        clinic.especialidades = [...new Set(clinic.especialidades)];
      }
      if (descMatch) clinic.descripcion = descMatch[1].trim();
      if (webMatch) clinic.web = webMatch[1].trim();
      if (featuredMatch) clinic.featured = featuredMatch[1].trim() === 'true';
    }
    
    // Ensure at least 'general' if no valid specialties
    if (clinic.especialidades.length === 0) {
      clinic.especialidades = ['general'];
    }
    
    if (clinic.slug && !clinic.slug.match(/^\s*$/)) {
      clinics.push(clinic);
    } else if (clinic.name && clinic.ciudad) {
      // Generate slug from name + city
      clinic.slug = slugify(clinic.name + '-' + clinic.ciudad.split(',')[0]);
      clinics.push(clinic);
    }
  }
  
  return clinics;
}

// Argentina-specific filter (aggressive)
function isGoodArgentina(clinic) {
  const name = clinic.name.toUpperCase();
  
  // Exclude patterns
  const excludePatterns = [
    'CAPS ', ' CAPS', 'UPA ', ' UPA', 'PUESTO SANITARIO', 'PUESTO DE SALUD',
    'SALA DE PRIMEROS AUXILIOS', 'SALA PRIMEROS AUXILIOS',
    'UNIDAD DE ATENCIÓN PRIMARIA', 'UNIDAD DE ATENCION PRIMARIA',
    'UNIDAD SANITARIA', 'CONSULTORIO PARTICULAR', 'CONSULTORIO ODONTOLOGICO',
    'CONSULTORIO ODONTOLÓGICO', 'FARMACIA', 'LABORATORIO ANALISIS',
    'LABORATORIO DE ANALISIS', 'LABORATORIO DE ANÁLISIS',
    'OPTICA', 'ÓPTICA', 'KINESIOLOGIA', 'KINESIOLOGY',
    'PODOLOGIA', 'PODOLOGÍA', 'FISIOTERAPIA', 'FONOAUDIOLOGIA',
    'PSICOLOGIA ', 'PSICOLOGÍA ', 'RADIOLOGIA ',
    'DIAGNÓSTICO POR IMAGEN', 'DIAGNOSTICO POR IMAGEN',
    'HEMODIÁLISIS', 'HEMODIALISIS',
    'VACUNATORIO', 'BANCO DE SANGRE', 'TRASLADOS', 'AMBULANCIAS',
    'HOGAR GERIÁTRICO', 'HOGAR GERIATRICO', 'HOGAR DE ANCIANOS',
    'RESIDENCIA PARA', 'RESIDENCIA GERONTOLÓGICA',
    'C.P.A. ODONTOLOGIA', 'ESTÉTICA CORPORAL', 'NUTRICIONISTA',
    'NUTRICION ', 'NUTRICIÓN ',
    'CRECIENDO',
    'REMISALUD',
    'CENTRO DE PRIMEROS AUXILIOS',
  ];
  
  for (const pat of excludePatterns) {
    if (name.includes(pat)) return false;
  }
  
  // Excluse by exact name patterns
  const exactExclude = ['CRECIENDO', 'REMISALUD'];
  if (exactExclude.includes(clinic.name.toUpperCase().trim())) return false;
  
  // Must contain a quality indicator
  const includePatterns = [
    'HOSPITAL', 'CLINICA', 'CLÍNICA', 'SANATORIO', 'INSTITUTO',
    'CENTRO MÉDICO', 'CENTRO MEDICO', 'POLICLÍNICO', 'POLICLINICO',
    'FUNDACIÓN', 'FUNDACION', 'CENTRO DE ESPECIALIDADES',
    'CENTRO CARDIOVASCULAR', 'CENTRO ONCOLÓGICO', 'CENTRO ONCOLOGICO',
    'CENTRO NEUROLÓGICO', 'CENTRO NEUROLOGICO',
    'MATERNIDAD', 'CENTRO MATERNO',
  ];
  
  let hasGoodType = false;
  for (const pat of includePatterns) {
    if (name.includes(pat)) {
      hasGoodType = true;
      break;
    }
  }
  
  if (!hasGoodType) return false;
  
  // For REFES bulk data (generic description), require a proper web or strong name
  if (clinic.descripcion && clinic.descripcion.includes('REFES Argentina')) {
    if (!clinic.web) {
      // Accept if name has strong quality signal
      const strongSignals = ['HOSPITAL', 'SANATORIO', 'FUNDACION', 'FUNDACIÓN', 'INSTITUTO', 'CLINICA', 'CLÍNICA'];
      let hasStrong = false;
      for (const sig of strongSignals) {
        if (name.includes(sig)) { hasStrong = true; break; }
      }
      if (!hasStrong) return false;
    }
  }
  
  return true;
}

// Generic filter for all countries
function isGoodClinic(clinic, country) {
  if (!clinic.name || !clinic.ciudad) return false;
  if (clinic.name.length < 4) return false;
  
  const name = clinic.name.toUpperCase();
  
  // Universal exclusions
  const universalExclude = [
    'CONSULTORIO PARTICULAR', 'PUESTO DE SALUD', 'PUESTO SANITARIO',
    'FARMACIA ', ' FARMACIA', 'OPTICA ', ' ÓPTICA',
    'BANCO DE SANGRE', 'VACUNATORIO', 'AMBULANCIAS', 'TRASLADOS',
  ];
  
  for (const pat of universalExclude) {
    if (name.includes(pat)) return false;
  }
  
  if (country === 'argentina') {
    return isGoodArgentina(clinic);
  }
  
  // For other countries, accept most entries that passed universal filter
  return true;
}

// Generate MD content for a clinic
function generateMdContent(clinic) {
  const esp = JSON.stringify(clinic.especialidades);
  const web = clinic.web ? `"${clinic.web.replace(/"/g, '\\"')}"` : '""';
  const desc = (clinic.descripcion || '').replace(/"/g, '\\"');
  const nombre = clinic.name.replace(/"/g, '\\"');
  const ciudad = clinic.ciudad.replace(/"/g, '\\"');
  
  return `---
name: "${nombre}"
slug: "${clinic.slug}"
pais: "${clinic.pais}"
ciudad: "${ciudad}"
especialidades: ${esp}
descripcion: "${desc}"
web: ${web}
featured: ${clinic.featured}
draft: false
---

${clinic.descripcion || ''}
`;
}

// Fix existing files with invalid specialties
function fixExistingFiles() {
  let fixed = 0;
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const espMatch = content.match(/^especialidades:\s*(\[.*?\])/m);
        if (!espMatch) continue;
        
        let needsFix = false;
        try {
          const rawEsp = JSON.parse(espMatch[1]);
          const normalized = rawEsp.map(s => normalizeSpecialty(s)).filter(Boolean);
          const deduped = [...new Set(normalized)];
          const final = deduped.length > 0 ? deduped : ['general'];
          
          if (JSON.stringify(rawEsp) !== JSON.stringify(final)) {
            needsFix = true;
            const newContent = content.replace(
              /^especialidades:\s*\[.*?\]/m,
              `especialidades: ${JSON.stringify(final)}`
            );
            fs.writeFileSync(fullPath, newContent, 'utf8');
            fixed++;
          }
        } catch (e) {
          // Skip if JSON parse fails
        }
      }
    }
  }
  
  walkDir(CONTENT_DIR);
  return fixed;
}

// Main
function main() {
  console.log('=== MedicinaVip Clinic Expander ===\n');
  
  // First fix any existing files with invalid specialties
  console.log('Fixing existing files with invalid specialties...');
  const fixed = fixExistingFiles();
  console.log(`Fixed ${fixed} existing files.\n`);
  
  const existingSlugs = collectExistingSlugs();
  console.log(`Existing slugs: ${existingSlugs.size}`);
  
  const existingCounts = countExistingPerCountry();
  console.log('\nExisting counts per country:');
  for (const [country, count] of Object.entries(existingCounts)) {
    console.log(`  ${country}: ${count}`);
  }
  
  const stats = {};
  let totalCreated = 0;
  let totalSkipped = 0;
  
  const countries = Object.keys(TARGETS);
  
  for (const country of countries) {
    const target = TARGETS[country];
    const existingCount = existingCounts[country] || 0;
    const needed = Math.max(0, target - existingCount);
    
    console.log(`\n--- ${country} ---`);
    console.log(`  Target: ${target}, Existing: ${existingCount}, Needed: ${needed}`);
    
    if (needed === 0) {
      console.log(`  Already at or above target, skipping.`);
      stats[country] = { created: 0, skipped: 0, filtered: 0, duplicates: 0 };
      continue;
    }
    
    // Parse research file
    const clinics = parseResearchFile(country);
    console.log(`  Parsed ${clinics.length} entries from research file`);
    
    // Filter
    const filtered = clinics.filter(c => isGoodClinic(c, country));
    console.log(`  After filtering: ${filtered.length}`);
    
    // Deduplicate among parsed
    const seenSlugs = new Set(existingSlugs);
    const countryDir = path.join(CONTENT_DIR, country);
    
    if (!fs.existsSync(countryDir)) {
      fs.mkdirSync(countryDir, { recursive: true });
    }
    
    let created = 0;
    let skipped = 0;
    let duplicates = 0;
    
    for (const clinic of filtered) {
      if (created >= needed) break;
      
      // Check slug uniqueness
      let slug = clinic.slug;
      if (!slug) {
        slug = slugify(clinic.name + '-' + (clinic.ciudad || '').split(',')[0]);
        clinic.slug = slug;
      }
      
      if (seenSlugs.has(slug)) {
        duplicates++;
        skipped++;
        continue;
      }
      
      // Validate minimum data
      if (!clinic.name || !clinic.ciudad) {
        skipped++;
        continue;
      }
      
      // Write file
      const filePath = path.join(countryDir, `${slug}.md`);
      if (fs.existsSync(filePath)) {
        duplicates++;
        skipped++;
        seenSlugs.add(slug);
        continue;
      }
      
      const content = generateMdContent(clinic);
      fs.writeFileSync(filePath, content, 'utf8');
      seenSlugs.add(slug);
      created++;
    }
    
    stats[country] = { created, skipped, filtered: filtered.length, duplicates };
    totalCreated += created;
    totalSkipped += skipped;
    
    console.log(`  Created: ${created}, Skipped: ${skipped} (${duplicates} duplicates)`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total created: ${totalCreated}`);
  console.log(`Total skipped: ${totalSkipped}`);
  
  console.log('\nPer country breakdown:');
  for (const [country, s] of Object.entries(stats)) {
    const existing = existingCounts[country] || 0;
    const newTotal = existing + s.created;
    const target = TARGETS[country];
    console.log(`  ${country}: ${existing} → ${newTotal} (target: ${target}, created: ${s.created})`);
  }
}

main();
