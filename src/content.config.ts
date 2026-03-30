import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const clinicas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/clinicas' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    pais: z.enum([
      'mexico', 'argentina', 'colombia', 'espana', 'chile', 'peru', 'uruguay',
      'venezuela', 'ecuador', 'bolivia', 'paraguay', 'guatemala', 'panama',
      'costa-rica', 'republica-dominicana', 'puerto-rico', 'honduras',
      'el-salvador', 'nicaragua', 'cuba'
    ]),
    ciudad: z.string(),
    especialidades: z.array(z.enum([
      'oncologia', 'cardiologia', 'neurologia', 'cirugia', 'estetica',
      'checkup', 'fertilidad', 'ortopedia', 'trasplantes', 'neonatologia',
      'pediatria', 'geriatria', 'oftalmologia', 'dermatologia', 'odontologia',
      'psiquiatria', 'rehabilitacion', 'urgencias', 'medicina-interna', 'gastroenterologia',
      'neumologia', 'urologia', 'ginecologia', 'endocrinologia', 'reumatologia',
      'hematologia', 'infectologia', 'cirugia-robotica', 'hepatologia', 'general'
    ])),
    descripcion: z.string(),
    direccion: z.string().optional(),
    telefono: z.string().optional(),
    web: z.string().optional(),
    email: z.string().optional(),
    certificaciones: z.array(z.string()).optional(),
    medicos_destacados: z.array(z.string()).optional(),
    fundacion: z.number().optional(),
    camas: z.number().optional(),
    imagen: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const articulos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articulos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    updated: z.string().optional(),
    pais: z.string().optional(),
    ciudad: z.string().optional(),
    especialidad: z.string().optional(),
    keywords: z.array(z.string()),
    author: z.string(),
    heroImage: z.string().optional(),
    imageAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { clinicas, articulos };
