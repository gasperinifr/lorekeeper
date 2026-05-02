# Lorekeeper

Plataforma para organização de campanhas de RPG de mesa. Centraliza personagens, NPCs, locais, itens e eventos, com suporte a IA generativa para auxílio na criação de conteúdo. Integração com 5e Tools para importação de criaturas e itens do D&D 5ª edição.

---

## Demo

Acesse: https://lorekeeperfg.vercel.app/dashboard

---

## Stack

### Frontend

![React](https://img.shields.io/badge/React-18-20232A?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss)
![React Query](https://img.shields.io/badge/React_Query-TanStack-FF4154?logo=reactquery)
![Zustand](https://img.shields.io/badge/Zustand-State-000000)
![React Router](https://img.shields.io/badge/React_Router-6-CA4245?logo=reactrouter)

### Backend

![Fastify](https://img.shields.io/badge/Fastify-4-000000?logo=fastify)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)
![AWS S3](https://img.shields.io/badge/AWS_S3-Storage-FF9900?logo=amazonaws)
![Groq](https://img.shields.io/badge/Groq-AI-000000)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens)

---

## Features

* Gerenciamento de campanhas com estrutura narrativa
* Criação e organização de personagens, NPCs, locais e itens
* Editor de notas com suporte a Markdown
* Geração automática de conteúdo com IA
* Chat contextual da campanha
* Upload de imagens com crop integrado
* Busca global
* Importação de criaturas e itens do D&D 5e

---

## Como rodar localmente

### Clone o projeto

```bash
git clone <repo-url>
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

Servidor backend roda por padrão na porta **3333**

---

## Variáveis de ambiente

### Backend

```env
PORT=
DATABASE_URL=
JWT_SECRET=
GROQ_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
```

### Frontend

```env
VITE_API_URL=
```

---

## Deploy

* Frontend: Vercel (deploy automático via branch main)
* Backend: Node.js em servidor dedicado
* Banco de dados: Supabase (PostgreSQL)

---

## Roadmap

* Sistema de permissões por usuário
* Exportação de campanhas
* Integração com outros sistemas além do 5e Tools
* Melhorias na IA contextual

---

## Licença

MIT
