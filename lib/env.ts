import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default('memory://'),
  NEXT_PUBLIC_API_URL: z.string().url().optional().default('http://localhost:13000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.warn('⚠️  Invalid environment variables, using defaults:', result.error.format())
}

export const env = result.data || {
  DATABASE_URL: 'memory://',
  NEXT_PUBLIC_API_URL: 'http://localhost:13000',
  NODE_ENV: 'development',
}
