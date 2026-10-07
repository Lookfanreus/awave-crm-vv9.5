// As telas suas que aparecem no menu lateral do CRM.
//
// Descomente e edite. Cada item precisa de:
//   titulo   — o texto do menu, até 40 caracteres. ACIMA DISSO O ITEM NÃO APARECE
//              (ele não é cortado: some inteiro). VAZIO ou em branco também derruba o item
//   caminho  — tem que começar com /x/ e bater com a pasta em custom/paginas/.
//              Até 200 caracteres; acima disso, vazio, ou fora de /x/, o item não aparece.
//              Só letras minúsculas, números e hífen no meio: /x/Financeiro, /x/relatórios,
//              /x/meu_modulo e /x/financeiro- são recusados, e no máximo /x/a/b (3 níveis)
//   icone    — opcional; um dos nomes listados no custom/LEIA-ME.md.
//              Nome fora da lista vira o ícone padrão (o item continua aparecendo)
//   grupo    — opcional; o rótulo acima do item (padrão: "Personalizado").
//              Até 24 caracteres; acima disso cai no padrão (o item continua aparecendo)
//
// 🔴 NO MÁXIMO 10 ITENS. A partir do 11º válido, o resto é ignorado — a conta é de itens
// VÁLIDOS, então entradas recusadas não gastam a cota.
//
// Um item recusado some sem erro na tela e sem linha no log. Se um item seu não apareceu,
// confira esta lista antes de procurar em qualquer outro lugar.

export default [
  // { titulo: 'Financeiro', caminho: '/x/financeiro', icone: 'Wallet' },
]
