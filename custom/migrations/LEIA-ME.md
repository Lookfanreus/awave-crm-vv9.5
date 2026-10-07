# `custom/migrations/`

Arquivos `.sql` seus, numerados a partir de **9000**, aplicados no boot junto com as
atualizações oficiais.

Formato do nome: `9001_descricao_curta.sql` — quatro dígitos, sublinhado, `.sql`.

Leia o aviso sobre **RLS** em [`../LEIA-ME.md`](../LEIA-ME.md) antes de criar uma tabela
que guarde dado de cliente. Sem RLS, um espaço de trabalho enxerga o dado do outro.

Esta pasta pode ficar vazia — o CRM sobe normalmente sem nenhuma migration sua.
