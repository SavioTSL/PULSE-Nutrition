# Auditoria — PULSE Nutrition

Revisão visual, funcional, de acessibilidade e desempenho. O README continua apenas com a apresentação do projeto.

## Resultado medido

Lighthouse 12.8.2, perfil mobile padrão, Chromium headless, servidor local Python. Comparação feita com a mesma URL e ferramenta. São medições de laboratório; a Vercel, a rede e aparelhos reais podem apresentar resultados diferentes.

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Desempenho | 69 | 92 |
| Acessibilidade | 100 | 100 |
| Boas práticas | 100 | 100 |
| SEO | 100 | 100 |
| Primeiro conteúdo visível (FCP) | 3,0 s | 1,5 s |
| Maior conteúdo visível (LCP) | 5,3 s | 3,3 s |
| Deslocamento de layout (CLS) | 0,143 | 0 |
| Bloqueio total (TBT) | 0 ms | 70 ms |

O TBT final permanece abaixo de 200 ms, referência de bom resultado do Lighthouse. O LCP ainda pode melhorar: a referência de bom resultado é até 2,5 s. Os valores observados estão em [reports/audit-metrics.json](reports/audit-metrics.json).

## Problemas corrigidos

| Área | Problema encontrado | Alteração |
| --- | --- | --- |
| Identidade visual | Quatro categorias ainda usavam desenhos planos | Novas embalagens 3D de pré-treino, vitaminas, barra e shaker, aplicadas nas categorias, produtos, detalhes e carrinho |
| Consistência da marca | Whey tinha símbolo de registro e um artefato lateral na imagem | Limpeza da imagem; a marca segue identificada como fictícia |
| Desempenho | Fontes TTF pesadas, CSS/JS sem minificação e fotos JPEG | Fontes WOFF2 com subconjunto latino, preload das fontes principais, CSS e JS minificados, fotos WebP |
| Imagens | Categorias baixavam a mesma imagem grande do modal | Versões responsivas de 320 e 640 px com `srcset` e `sizes`; imagem principal com prioridade de carregamento |
| Escolha de produto | Favoritar um item restaurava o primeiro sabor | Variação selecionada preservada ao atualizar favoritos e filtros |
| Carrinho | Adição acima de 99 descartava o excedente e apresentava sucesso | Adição recusada com mensagem clara; nenhuma quantidade descartada silenciosamente |
| Validação | Índice negativo poderia remover a última linha pelo método do carrinho | Índices de remoção validados |
| Teclado | Foco podia desaparecer ao remover o último favorito | Foco retorna ao controle de favoritos |
| Teclado | Header podia continuar escondido com links focados | Header aparece ao receber foco e permanece visível enquanto é usado por teclado |
| Carrossel | Autoplay podia reiniciar durante interação por teclado | Pausa enquanto o foco está dentro do hero |
| Mobile | Favoritos e ajuste de quantidade tinham alvos pequenos | Ações principais com áreas de toque de pelo menos 44 × 44 px; textos comerciais maiores |
| Nomes acessíveis | Nome do logo e texto do botão de pausa geravam alerta no Lighthouse | Nome natural do logo e controles de reprodução em SVG com descrição acessível |

## Validações executadas

- Quatro testes de lógica do carrinho: preços em centavos, variações, quantidades, limites, persistência, dados corrompidos e armazenamento indisponível.
- Fluxo integrado em Chromium: pesquisa, filtros, ordenação, galeria, detalhes, favoritos, carrinho, remoção, subtotal, recarga, clipboard, modais, menu e slider.
- Link do WhatsApp testado com destino interceptado, sem envio de mensagem.
- Regressões da auditoria: preservação de sabor, foco, pausa com teclado, limite de 99, carregamento das imagens e áreas de toque.
- Layouts de 320, 375, 390, 768 e 1440 px sem overflow horizontal.
- Catálogo com oito produtos visíveis também com JavaScript desativado; recursos interativos continuam exigindo JavaScript.
- Axe com regras WCAG 2 A/AA, 2.1 A/AA e 2.2 AA, sem violações detectadas nos estados da página, detalhes, carrinho, privacidade e menu mobile.
- Nenhum erro JavaScript ou HTTP observado no fluxo de regressão.

Os testes estão em `tests/cart.test.mjs`, `tests/browser.cjs`, `tests/audit.cjs` e `tests/accessibility.cjs`. A aprovação automática não substitui revisão com leitores de tela ou certifica conformidade completa.

## Próximas melhorias recomendadas

1. **Validar o site publicado e aparelhos reais.** Medir Lighthouse e Core Web Vitals na Vercel; verificar cache, compressão, Safari/iPhone, Android e navegação com VoiceOver. Cache e compressão do servidor local não representam a configuração de produção.
2. **Completar a apresentação dos dois produtos especiais.** Criar imagem exclusiva de Whey Isolate e embalagem de caixa com 12 barras. Atualmente compartilham as imagens do whey e da barra individual. Também vale mostrar a embalagem correspondente ao tamanho/sabor selecionado.
3. **Dar mais personalidade aos textos de produtos.** Cada item ainda usa uma descrição introdutória comum. Criar textos próprios sobre apresentação, sabores e características físicas, mantendo rótulos ilustrativos e sem promessas de saúde.
4. **Concluir a experiência de compartilhamento.** Com domínio definido, adicionar URL canônica e imagem social com URL absoluta. Título, descrição, idioma e metadados Open Graph básicos já estão presentes.
5. **Ativar contato somente com dados autorizados.** Configurar o número da loja e testar a conversa real de orçamento. A cópia do resumo já funciona; não existe confirmação automática de pedido.
6. **Ativar newsletter somente com serviço real.** Configurar o endpoint HTTPS e adequar o texto de privacidade ao serviço escolhido. Hoje o formulário permanece explicitamente demonstrativo e desativado.

O site continua uma demonstração comercial: não há estoque real, vendas, processamento de pagamentos ou estatísticas reais de “mais vendidos”.

## Manutenção

Após editar dados, módulos JavaScript ou CSS, execute `sh scripts/build.sh`. O comando atualiza o catálogo inicial do HTML, o JavaScript de navegador e o CSS minificado. Requer Node/npm e acesso ao registro npm para o esbuild versionado; o site já publicado não depende dessas ferramentas.
