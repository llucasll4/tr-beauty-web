# Melhoria — Foto do perfil com recorte e pré-visualização

## Funcionalidades

- Cliente entra em **Perfil**, seleciona foto e abre o editor antes de enviar.
- Pré-visualização ao vivo na moldura circular, com controles de **zoom**, **posição horizontal** e **posição vertical**.
- Botão **Centralizar foto** e ações **Cancelar** / **Salvar foto**.
- O arquivo original **não tem restrições artificiais de tamanho mínimo ou máximo no formulário**. O navegador precisa conseguir decodificar a imagem, conforme sua capacidade de memória e formatos suportados.
- Arquivo final é quadrado (420 × 420 pixels), convertido para JPG e comprimido para atender ao limite do bucket Supabase de até 2 MB.
- Assim que a cliente salva, a foto recortada aparece no perfil imediatamente pela prévia local, ainda durante o envio; falhas retornam à imagem anterior.
- Depois do envio, o banco atualiza `profiles.avatar_path` e a prévia local é mantida para evitar imagens antigas em cache.
- Não há dependências novas.

## Segurança e backend

- Supabase bucket `avatars` mantém seu limite de **2 MB para o arquivo final**, independente do tamanho do original.
- O upload salva em `<auth.uid()>/avatar.jpg`, dentro da pasta da própria cliente, com `upsert: true`.
- Policies existentes já permitem INSERT/UPDATE para a própria pasta; adicionada política SELECT restrita à mesma pasta, exigida no upsert.
- Migração `supabase/migrations/20261109_avatar_select_own.sql` já aplicada em produção. **Não reexecutar**.
- O sistema continua exigindo login para visualizar e alterar o perfil.
- Galeria pública, agendamentos, P4 e financeiro não foram alterados.

## Checklist de aceite

- [ ] Em uma conta cliente, selecionar JPG/PNG e abrir editor.
- [ ] Ajustar zoom e posição, verificando mudança instantânea na prévia circular.
- [ ] Clicar em **Cancelar** e verificar que a foto antiga não muda.
- [ ] Selecionar imagem original maior que 2 MB: editor deve abrir, desde que navegador consiga decodificar.
- [ ] Clicar em **Salvar foto** e verificar atualização instantânea do avatar na tela.
- [ ] Recarregar página e confirmar foto salva.
- [ ] Trocar a foto outra vez e confirmar que substitui a anterior.
- [ ] Testar no navegador do celular, selecionando imagem da galeria.
- [ ] Testar PNG transparente e imagem panorâmica.
- [ ] Conta de outra cliente não consegue alterar o avatar alheio.

## Limitações esperadas

- Arquivos não suportados pelo navegador, imagens corrompidas ou enormes além da memória disponível podem falhar mesmo sem limite de peso no formulário. A UI oferece mensagem para escolher JPG/PNG/WEBP nesses casos.
- O resultado publicado é JPG otimizado; o arquivo original não é armazenado e a transparência é convertida em fundo branco.
- Controles atuais de recorte utilizam sliders (zoom e posição), compatíveis com mouse e toque; não há gesto de pinça nesta versão.
