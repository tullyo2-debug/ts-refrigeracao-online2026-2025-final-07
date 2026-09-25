# TS Refrigeração — Correção de módulos

Esta versão deixa o sistema com acesso completo aos módulos para usuários autenticados e acrescenta:
- Clientes: editar e excluir cadastros.
- Agenda: listagem exposta e edição dos agendamentos.
- Ordens de serviço: editar OS, alterar status, fechar OS e integrar automaticamente ao financeiro quando o pagamento estiver como Pago.
- Financeiro: visualizar, criar e editar lançamentos.
- Serviços: cadastrar, editar valores, descrição e ativar/inativar.
- Usuários: administrador pode criar, editar, ativar/desativar e excluir sub-usuários com acesso ao Auth.

A Edge Function `gerenciar-subusuarios` já foi publicada no Supabase.
As regras de integração financeira foram aplicadas no banco.

No Vercel, use as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
