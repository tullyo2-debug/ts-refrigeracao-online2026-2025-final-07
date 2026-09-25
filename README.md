# TS Refrigeração — Vercel CORREÇÃO FINAL 2

Projeto Vite + JavaScript + Supabase preparado para Vercel.

## IMPORTANTE
Este ZIP está com a estrutura do projeto diretamente na raiz. Ao enviar/importar o projeto, `package.json`, `index.html` e `vercel.json` precisam ficar na raiz do projeto.

## Configuração Vercel
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

As variáveis podem ser configuradas em Vercel → Project Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

O arquivo `.env.production` também está incluído com a URL e a chave publishable fornecidas para este projeto.

## Rotas
O `vercel.json` encaminha as rotas da aplicação para `index.html`, sem interferir nos arquivos gerados em `/assets/`.

## Supabase
O sistema espera que as tabelas e políticas do banco já estejam criadas no projeto Supabase.


CORRECAO FINAL4: entrada do Vite movida para main.js na raiz para eliminar falhas de resolucao do caminho /src/main.js em ambientes de deploy.
