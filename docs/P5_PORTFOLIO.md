# TR Beauty Concept — P5 Portfólio administrativo

## Status e arquitetura

- Aplicação React Native Web (Expo) hospedada na Vercel.
- Banco: tabela `public.portfolio_photos` no Supabase.
- Fotos: bucket público `portfolio` no Supabase Storage, até 5 MB por arquivo.
- Cliente: aba **Galeria** na navegação inferior, com fotos reais e filtro por serviço.
- Administradora: **Admin → Portfólio**, com publicação, alteração, substituição da imagem, ordem e exclusão.
- Acesso: políticas RLS no banco e em `storage.objects`; só contas com `public.profiles.role = 'admin'` podem escrever.
- JPG/PNG/WEBP, até 5 MB, sem novas dependências ou credenciais.
- Galeria inicialmente vazia: nenhuma foto foi inventada ou publicada automaticamente.

## Migração

Arquivo: `supabase/migrations/20261108_p5_portfolio.sql`.
Já aplicada ao projeto Supabase `tr-beauty-web` através do conector.
**Não a execute novamente** em produção. Para verificar:

```sql
select count(*) as fotos from public.portfolio_photos;
select id, public, file_size_limit from storage.buckets where id = 'portfolio';
```

## Uso como administradora

1. Entre em https://trbeautyconcept.com.br com sua conta administradora.
2. Abra **Admin → Portfólio → Adicionar trabalho**.
3. Digite título, descrição opcional, selecione o serviço relacionado e escolha uma foto.
4. Clique em **Publicar foto**.
5. Confira na aba **Galeria** (na conta da cliente).
6. Teste **Editar**, **Mover para cima/baixo** e **Excluir foto** (a confirmação exige segundo clique).

O campo de foto é um seletor de arquivos no navegador. No celular, abrir o site no navegador permite selecionar uma foto da galeria do aparelho.

## Regras de segurança e privacidade

- O bucket é **público**. Fotos publicadas são acessíveis por URL. Não envie fotos que não possam ser divulgadas.
- Antes de publicar, obtenha autorização das clientes retratadas e evite imagens com dados pessoais ou informações de localização (EXIF).
- Não armazene selfies, documentos ou outros dados pessoais no portfólio.
- Toda manipulação de foto passa pelas regras do Supabase: esconder botões no frontend não é usado como segurança.
- A exclusão remove a linha do banco e solicita apagar a imagem do Storage. Se o Storage falhar, a foto sai da galeria, mas pode restar um arquivo órfão; a interface avisa a administradora.
- Fotos com serviço excluído continuam na galeria e são classificadas como `Outros`.
- A visualização usa até 250 itens; se ultrapassar o limite, implementar paginação.

## Testes antes de marcar P5 concluída

- [ ] Admin: publicar JPG/PNG/WEBP e conferir imagem visível
- [ ] Admin: editar título, descrição e serviço vinculado
- [ ] Admin: substituir imagem e atualizar ordenação
- [ ] Admin: excluir foto com confirmação
- [ ] Cliente: navegar, filtrar e ver imagens
- [ ] Cliente: confirmar que não possui botões admin nem permissão de upload
- [ ] Arquivo maior que 5 MB é rejeitado
- [ ] Conferir funcionamento no celular

## Observações

P0–P4 não foram alteradas por esta etapa; o WhatsApp continua adiado. O e-mail continua processado pela Edge Function e pelo Cron do Supabase. O portfólio não exige Secrets novos, e as fotos são enviadas diretamente ao Storage sob RLS.
