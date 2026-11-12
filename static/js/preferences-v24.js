/* LambdaMorph 2.4 — reversible theme and UI localization layer.
   No measurement state, coordinates, calculations or image pixels are changed. */
(() => {
  'use strict';
  const prefKey = 'echometrics.preferences.v24';
  const exact = {
    'Scientific Ultrasound Image Analysis': 'Análise científica de imagens ultrassonográficas',
    'Source code': 'Código-fonte', 'Measurement workspace': 'Área de mensuração',
    'Ultrasound image analysis': 'Análise de imagens ultrassonográficas',
    'Calibrate, measure and export reproducible results.': 'Calibre, mensure e exporte resultados reprodutíveis.',
    'Import': 'Importar', 'Calibrate': 'Calibrar', 'Outline AOL': 'Delimitar AOL',
    'Measure EGS': 'Medir EGS', 'Results': 'Resultados',
    '01 / Configure': '01 / CONFIGURAR', '03 / Review': '03 / REVISAR',
    'Analysis setup': 'Configuração da análise',
    'Choose the mode and identify your measurements.': 'Escolha o modo e identifique suas mensurações.',
    'Measurement values will appear after analysis.': 'Os valores aparecerão após a análise.',
    'Analysis Mode:': 'Modo de análise:', 'Individual': 'Individual', 'Batch': 'Em lote',
    'Animal ID (optional)': 'ID do animal (opcional)',
    'Session ID (optional)': 'ID da sessão (opcional)',
    'Species (optional)': 'Espécie (opcional)', 'Select species': 'Selecione a espécie',
    'Ovine': 'Ovina', 'Bovine': 'Bovina', 'Caprine': 'Caprina', 'Other': 'Outra',
    'Body condition score (optional)': 'Escore de condição corporal (opcional)',
    'Scale reference length (cm) — set before loading image': 'Comprimento de referência (cm) — defina antes de carregar',
    'EGS measurements per image': 'Medições de EGS por imagem',
    '1 measurement': '1 medição', '2 measurements': '2 medições', '3 measurements': '3 medições',
    'Set before loading. Each EGS line is measured independently.': 'Defina antes de carregar. Cada linha de EGS é medida independentemente.',
    'Ultrasound image': 'Imagem ultrassonográfica',
    'Click to select an image': 'Clique para selecionar uma imagem',
    'or drag and drop it here': 'ou arraste e solte aqui',
    'PNG, JPG, BMP or GIF · max. 20 MB': 'PNG, JPG, BMP ou GIF · máx. 20 MB',
    'Reset': 'Reiniciar', 'Download annotated image': 'Baixar imagem anotada',
    'Download Excel': 'Baixar Excel', 'Start Batch': 'Iniciar lote', 'Batch Code:': 'Código do lote:',
    'Your image workspace': 'Sua área de imagens',
    'Upload an ultrasound image to start calibrating and tracing the measurements.': 'Carregue uma imagem ultrassonográfica para calibrar e iniciar as marcações.',
    'Longissimus dorsi area (AOL):': 'Área de olho de lombo (AOL):',
    'Mean subcutaneous fat thickness (EGS):': 'Espessura média de gordura subcutânea (EGS):',
    'Subcutaneous fat thickness (EGS):': 'Espessura de gordura subcutânea (EGS):',
    'Calibration:': 'Calibração:', 'AOL perimeter:': 'Perímetro da AOL:',
    'Muscle depth (manual):': 'Profundidade muscular (manual):',
    'EGS summary:': 'Resumo da EGS:',
    'Review / edit measurements': 'Revisar / editar mensurações',
    'Review measurements': 'Revisar mensurações',
    'Edit scale': 'Editar escala', 'Edit AOL': 'Editar AOL',
    'Edit EGS': 'Editar EGS', 'Edit depth': 'Editar profundidade',
    'Clear selected tool points': 'Limpar pontos da ferramenta selecionada',
    'Cancel changes': 'Cancelar alterações', 'Recalculate & save': 'Recalcular e salvar',
    'Skip muscle depth': 'Pular profundidade muscular',
    'Confirm Shape': 'Confirmar contorno', 'Confirm shape': 'Confirmar contorno',
    'Calculate': 'Calcular', 'Calculate results': 'Calcular resultados',
    'Next EGS': 'Próxima EGS', 'Undo': 'Desfazer', 'Redo': 'Refazer',
    'Contour mode': 'Modo de contorno', 'Contour actions': 'Ações do contorno',
    'AOL contour drawing tools': 'Ferramentas de desenho da AOL',
    'Freehand': 'Desenho livre', 'Polygon': 'Polígono', 'Edit points': 'Editar pontos',
    'Clear AOL': 'Limpar AOL',
    'Undo contour edit (Ctrl+Z)': 'Desfazer alteração do contorno (Ctrl+Z)',
    'Redo contour edit (Ctrl+Y)': 'Refazer alteração do contorno (Ctrl+Y)',
    'Clear only the AOL contour': 'Limpar apenas o contorno da AOL',
    'Freehand drawing': 'Desenho livre', 'Polygon drawing': 'Desenho por polígono',
    'Individual Mode': 'Modo individual',
    'Batch Mode — Setup': 'Modo em lote — configuração',
    'Load an image to start the analysis.': 'Carregue uma imagem para iniciar a análise.',
    'Analysis complete! Load another image to continue.': 'Análise concluída! Carregue outra imagem para continuar.',
    'Complete!': 'Concluído!', 'Calculation finished.': 'Cálculo concluído.',
    'Calculating…': 'Calculando…',
    'Step 1 — Calibrate': 'Etapa 1 — Calibrar',
    'Step 2 — Draw AOL': 'Etapa 2 — Delimitar AOL',
    'Step 4 — Muscle depth (optional)': 'Etapa 4 — Profundidade muscular (opcional)',
    'Not measured': 'Não mensurada',
    'No data to export yet.': 'Ainda não há dados para exportar.',
    'Excel downloaded successfully!': 'Excel baixado com sucesso!',
    'AOL contour self-intersects. Correct the crossing with Edit points.': 'O contorno da AOL cruza a si mesmo. Corrija o cruzamento em Editar pontos.',
    'No annotated image available.': 'Nenhuma imagem anotada disponível.',
    'Ready': 'Pronto', 'complete': 'concluídas',
    'Unsupported format. Use PNG, JPG, BMP or GIF.': 'Formato não aceito. Use PNG, JPG, BMP ou GIF.',
    'Drag-and-drop unavailable. Click here to select the image.': 'Arrastar e soltar indisponível. Clique aqui para selecionar.',
    'e.g. SHEEP_012': 'ex.: OVINO_012', 'e.g. DAY_01': 'ex.: DIA_01',
    'e.g. 2/5 (include the scale)': 'ex.: 2/5 (informe a escala)',
    'e.g. LOTE01': 'ex.: LOTE01',
  };
  const replacements = [
    ['Choose', 'Escolha'],
    ['below. Confirm when the green border matches the muscle boundary.', 'abaixo. Confirme quando a borda verde acompanhar o limite do músculo.'],
    ['Click to add points. Drag to adjust.', 'Clique para adicionar pontos. Arraste para ajustar.'],
    ['Right-click', 'Clique com o botão direito'], ['to undo', 'para desfazer'],
    ['Press', 'Pressione'], ['or click', 'ou clique em'], ['when done.', 'ao terminar.'],
    ['Mark two anatomical interfaces for independent EGS measurement', 'Marque duas interfaces anatômicas para a medição independente de EGS'],
    ['Use the scale length entered before loading the image, then click', 'Use a distância de referência informada antes de carregar a imagem e clique em'],
    ['two points', 'dois pontos'], ['spanning that distance.', 'que delimitem essa distância.'],
    ['Mark two points defining muscle depth according to your protocol, or choose', 'Marque dois pontos que definam a profundidade muscular conforme seu protocolo ou selecione'],
    ['Avoid interpreting image height automatically as anatomical depth.', 'Não interprete automaticamente a altura da imagem como profundidade anatômica.'],
    ['Select a tool above.', 'Selecione uma ferramenta acima.'],
    ['Drag points to adjust;', 'Arraste os pontos para ajustar;'],
    ['clear a tool to redraw it.', 'limpe uma ferramenta para redesenhá-la.'],
    ['Then choose', 'Depois escolha'],
    ['or', 'ou'],
    ['Upload error:', 'Erro no envio:'],
    ['Calculation error:', 'Erro no cálculo:'],
    ['Download error:', 'Erro no download:'],
    ['saved', 'salvo'],
    ['Batch row updated — no duplicate added.', 'Registro do lote atualizado — sem duplicação.'],
    ['Set before loading image', 'Defina antes de carregar a imagem'],
    ['Sample SD', 'Desvio-padrão amostral'],
    ['marks', 'marcações'],
  ];

  const memory = new WeakMap();
  let locale = 'en';
  let theme = 'light';
  let scheduled = false;

  function translate(source) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(source);
    if (!match) return source;
    let main = match[2];
    const trimmed = main.trim();
    if (Object.hasOwn(exact, trimmed)) return match[1] + exact[trimmed] + match[3];
    if (/^Step 3 — EGS \d+\/\d+$/.test(trimmed)) return match[1] + trimmed.replace('Step 3', 'Etapa 3') + match[3];
    if (/^Batch Mode — .+$/.test(trimmed)) return match[1] + trimmed.replace('Batch Mode', 'Modo em lote') + match[3];
    if (/^EGS \d+\/\d+ · \d+ complete$/.test(trimmed)) return match[1] + trimmed.replace('complete', 'concluídas') + match[3];
    if (/^\d+ images? saved\./.test(trimmed)) return match[1] + trimmed.replace(/images? saved\./, 'imagens salvas.') + match[3];
    for (const [en, pt] of replacements) {
      // General "or" replacement is only for full-word connective, never substrings.
      if (en === 'or') main = main.replace(/\bor\b/g, pt);
      else main = main.replaceAll(en, pt);
    }
    return match[1] + main + match[3];
  }

  function updateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,pre,code,.header-preferences,[data-no-translate]')) return;
    if (!node.nodeValue.trim()) return;
    const current = node.nodeValue;
    let entry = memory.get(node);
    if (!entry) { entry = {english: current, rendered: current}; memory.set(node, entry); }
    else if (current !== entry.rendered) entry.english = current; // application changed the text
    const target = locale === 'pt-BR' ? translate(entry.english) : entry.english;
    entry.rendered = target;
    if (current !== target) node.nodeValue = target;
  }
  function translateAttributes(el) {
    if (el.closest('.header-preferences') || el.hasAttribute('data-no-translate')) return;
    for (const attr of ['placeholder','aria-label','title']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const canonicalKey = `data-english-${attr}`;
      if (!el.hasAttribute(canonicalKey)) el.setAttribute(canonicalKey, value);
      const english = el.getAttribute(canonicalKey);
      const target = locale === 'pt-BR' ? translate(english) : english;
      if (target !== value) el.setAttribute(attr, target);
    }
  }
  function updateLocale() {
    document.documentElement.lang = locale;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) updateTextNode(node);
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(translateAttributes);
    const languageButton = document.getElementById('languageToggle');
    if (languageButton) {
      languageButton.textContent = locale === 'en' ? 'PT-BR' : 'EN';
      languageButton.title = locale === 'en' ? 'Alterar para português' : 'Switch to English';
      languageButton.setAttribute('aria-label', languageButton.title);
    }
  }
  function scheduleTranslate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateLocale(); });
  }
  function save() { try { localStorage.setItem(prefKey, JSON.stringify({locale, theme})); } catch (_) {} }
  function setTheme(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun" aria-hidden="true"></i><span></span>' : '<i class="fa-solid fa-moon" aria-hidden="true"></i><span></span>';
      btn.querySelector('span').textContent = locale === 'pt-BR' ? (theme === 'dark' ? 'Claro' : 'Escuro') : (theme === 'dark' ? 'Light' : 'Dark');
      btn.setAttribute('aria-label', locale === 'pt-BR' ? 'Alternar tema claro ou escuro' : 'Toggle light or dark mode');
      btn.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  }
  function setLocale(next) {
    locale = next === 'pt-BR' ? 'pt-BR' : 'en';
    updateLocale(); setTheme(theme); save();
  }
  function init() {
    if (!document.getElementById('themeToggle') || !document.getElementById('languageToggle')) return;
    try {
      const pref = JSON.parse(localStorage.getItem(prefKey) || '{}');
      locale = pref.locale === 'pt-BR' ? 'pt-BR' : 'en';
      theme = ['light','dark'].includes(pref.theme) ? pref.theme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (_) { locale = 'en'; theme = 'light'; }
    setTheme(theme);
    setLocale(locale);
    document.getElementById('themeToggle').addEventListener('click', () => { setTheme(theme === 'dark' ? 'light' : 'dark'); save(); });
    document.getElementById('languageToggle').addEventListener('click', () => setLocale(locale === 'en' ? 'pt-BR' : 'en'));
    const observer = new MutationObserver(scheduleTranslate);
    // Only textual changes. Attribute translation is applied during scheduled scan.
    observer.observe(document.body, {childList:true,characterData:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
