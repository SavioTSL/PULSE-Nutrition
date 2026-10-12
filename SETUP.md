# Ativação da loja e administração

A loja agora tem backend, checkout, acompanhamento e painel administrativo. As telas estão implementadas; cobranças reais e acesso ao banco dependem da configuração abaixo. Não existe senha padrão, conta administrativa simulada nem chave de pagamento incluída.

## Executar e desenvolver

Requer Node 22+ e npm. Use o checkout existente; cada tarefa cloud já é isolada, sem necessidade de worktree.

```sh
npm ci
npm run build
npm start
```

O servidor Node usa a porta 8000 e serve também a API. Um servidor apenas estático não executa login, banco ou pagamentos. Sem credenciais, o catálogo demonstrativo continua utilizável e o checkout informa o que falta.

Depois de alterar HTML, dados, CSS ou módulos JavaScript, execute `npm run build`. O diretório `public/` é gerado para publicação e não contém código de servidor, testes ou arquivos de ambiente.

## Variáveis seguras

Defina os valores na seção Environment Variables do projeto na Vercel, sem publicá-los no Git. No desenvolvimento, use um `.env` local ignorado, baseado em `.env.example`. Não envie senhas, tokens ou URLs com credenciais pelo chat.

| Nome                         | Configuração necessária                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`               | URL PostgreSQL de um banco dedicado à loja. Pode usar Neon, Supabase ou outro serviço PostgreSQL. Prefira o endpoint de conexão com pool do provedor.              |
| `ADMIN_EMAIL`                | E-mail da conta administrativa.                                                                                                                                    |
| `ADMIN_PASSWORD_HASH`        | Hash gerado por `npm run admin:password`. A senha é digitada sem aparecer no terminal; não use senhas de exemplo.                                                  |
| `SESSION_SECRET`             | Segredo aleatório com ao menos 32 caracteres para assinar sessões e acessos a pedidos. Gere localmente com um gerador criptográfico e salve nas variáveis seguras. |
| `SITE_URL`                   | Origem pública HTTPS exata da loja, sem caminhos ou barra final. Exemplo de desenvolvimento: `http://localhost:8000`.                                              |
| `MERCADOPAGO_ACCESS_TOKEN`   | Access Token da aplicação e da conta vendedora autorizada no Mercado Pago. Fica somente no servidor.                                                               |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta das notificações Webhooks configuradas no painel do Mercado Pago.                                                                               |
| `MERCADOPAGO_SANDBOX`        | `true` para testar com contas e credenciais de teste do provedor; `false` somente para produção com credenciais de produção. O padrão é teste.                     |
| `DATABASE_CA_CERT`           | Opcional, certificado raiz autorizado quando o provedor exigir uma CA específica. A verificação TLS permanece ativa.                                               |

O servidor não imprime os valores dessas variáveis. O script interativo de senha mostra apenas o hash a ser copiado para o campo seguro. Nenhuma senha fica no frontend. Rotacionar `SESSION_SECRET` invalida sessões administrativas; pedidos já salvos mantêm o hash do identificador de acesso originalmente entregue ao cliente.

## Inicializar o banco

Use um banco dedicado e configure `DATABASE_URL` no ambiente onde executará:

```sh
npm run db:setup
```

O comando cria as tabelas e adiciona o catálogo inicial sem sobrescrever produtos existentes. Esses produtos são **demonstrativos, com estoque zero e cobrança bloqueada**. A inicialização não transforma embalagens fictícias em mercadorias reais.

## Publicar na Vercel

Importe o repositório com preset **Other**. `vercel.json` configura instalação com `npm ci`, build com `npm run build`, arquivos públicos em `public/` e a função Node para `/api/*`. As instruções anteriores de deploy puramente estático foram substituídas por essa arquitetura.

Configure as variáveis do ambiente de Preview/Production pretendido e faça novo deploy. Use a mesma origem em `SITE_URL` e no navegador. Sessões administrativas usam cookies HttpOnly e SameSite Strict; em produção são Secure. Uma URL de preview diferente exige `SITE_URL` correspondente para as operações desse ambiente.

Rotas:

- `/`: loja do cliente.
- `/checkout`: dados, endereço, frete e redirecionamento para pagamento.
- `/pedido?order=...`: acompanhamento protegido pelo acesso salvo no navegador.
- `/pedidos`: histórico iniciado neste dispositivo.
- `/admin`: login, produtos, estoque, pedidos e configurações.
- `/privacidade`: informações sobre os dados utilizados.
- `/api/status`: disponibilidade da configuração, sem valores secretos.

## Configurar Mercado Pago

Na aplicação da conta vendedora autorizada, configure notificações **Payments** para:

```text
https://SEU-DOMINIO/api/payments/webhook
```

Guarde a assinatura secreta em `MERCADOPAGO_WEBHOOK_SECRET`. O checkout é hospedado pelo Mercado Pago; o site não recebe números de cartão ou códigos de segurança. As opções Pix/cartão disponíveis dependem da configuração e das regras do provedor para a conta.

A notificação é validada por HMAC e o servidor consulta o pagamento na API. Somente um pagamento com referência do pedido, moeda e valor correspondentes pode ser marcado como aprovado. O retorno `?status=approved` no navegador não confirma nada. A administração também pode consultar a API para sincronizar a situação.

O primeiro teste real de integração com as suas credenciais deve ser feito no ambiente de teste oficial do Mercado Pago. Os testes automatizados do repositório substituem o provedor por respostas controladas e não executam cobranças reais.

## Ativar o catálogo e as vendas

1. Entre em `/admin` com o e-mail e a senha que você configurou.
2. Cadastre ou edite produtos reais, com informações e imagens autorizadas, preço por variação e estoque disponível. Remova a marcação de produto demonstrativo apenas nesses itens reais. Ocultar um produto preserva pedidos já existentes.
3. Em Configurações, informe contato público, frete fixo por pedido e, opcionalmente, número autorizado de WhatsApp.
4. Ative o checkout somente após configurar o provedor e revisar os dados da operação. O backend bloqueia a ativação sem contato, frete e chaves necessárias.
5. Teste o fluxo oficial de teste: carrinho → dados → Mercado Pago → acompanhamento → confirmação no painel.
6. Depois de verificar o ambiente de teste, configure credenciais de produção, `MERCADOPAGO_SANDBOX=false` e publique novamente para aceitar vendas reais.

Preços e estoque são recalculados no servidor. Reservas expiram após 30 minutos e são liberadas nas próximas consultas de catálogo, pedidos ou checkout, em lotes de até 20 reservas para limitar o tempo de cada requisição. Uma aprovação tardia com estoque insuficiente é marcada para revisão, sem criar estoque negativo. Estornos são feitos no painel do Mercado Pago e sua situação pode ser sincronizada aqui; não há emissão de estorno pelo painel PULSE.

## Capacidades e limites atuais

- Um administrador configurado no servidor; login protegido por senha com scrypt, sessões revogáveis no banco, cookie HttpOnly, verificação de origem, CSRF e limitação de tentativas.
- Cadastro e edição de produtos, estoque por variação, ocultação, contato e ativação do checkout.
- Consulta de até 200 pedidos recentes; a receita exibida corresponde a esse conjunto, sem estatísticas fictícias.
- Preparação e entrega atualizadas apenas para pagamentos confirmados. Não existe botão para aprovar pagamento manualmente.
- Frete fixo configurável. Integrações com transportadoras, etiquetas, rastreamento automático e documentos fiscais não estão implementadas.
- Histórico do cliente protegido por identificadores salvos no dispositivo. Não há conta/login de cliente ou envio automático de e-mail de confirmação. O cliente pode acompanhar no navegador de origem ou entrar em contato com a loja.
- Newsletter permanece desativada sem serviço de captura, como antes.
- Pix/cartão, banco hospedado, domínio e aparelhos físicos não foram validados em produção nesta tarefa: dependem das credenciais, da URL e da ativação pelo responsável.

## Testes

```sh
npm test
```

Testa lógica de carrinho e API com PostgreSQL isolado via PGlite. Inclui autenticação, CSRF, origem, edição concorrente, preço manipulado, produtos demonstrativos, reserva de estoque, idempotência, webhook assinado, valor do pagamento, falhas e expiração.

Com Playwright, Chromium e axe instalados para desenvolvimento:

```sh
PLAYWRIGHT_PATH=/caminho/node_modules/playwright AXE_PATH=/caminho/node_modules/axe-core/axe.min.js CHROMIUM_PATH=/usr/bin/chromium node tests/commerce-browser.mjs
```

Esse teste inicia um servidor isolado com banco SQL e percorre painel → produto/preço/estoque → configurações → checkout → retorno não confirmado → webhook → confirmação → entrega. O destino do Mercado Pago é interceptado. Não envia mensagens, não usa credenciais reais e não movimenta dinheiro. Gera imagens de revisão em `/tmp/pulse-admin-desktop.png` e `/tmp/pulse-checkout-mobile.png`.
