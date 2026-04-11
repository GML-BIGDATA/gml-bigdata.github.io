/* ========================================
   GML BigData — Markdown-driven renderer
   ======================================== */

(async function () {
  'use strict';

  // ---- Fetch content.md ----
  let md;
  try {
    const res = await fetch('content.md');
    md = await res.text();
  } catch (e) {
    document.getElementById('app').innerHTML = '<p style="padding:80px;text-align:center;color:#999;">无法加载 content.md</p>';
    return;
  }

  // ---- Simple Markdown parser ----
  function parseMD(text) {
    const lines = text.split('\n');
    const sections = [];

    // Split by h2 (---) boundaries
    let current = { heading: '', content: [] };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Top-level h1 → site title
      if (line.startsWith('# ') && sections.length === 0 && current.heading === '') {
        current.heading = line.replace(/^# /, '');
        continue;
      }

      // h2 → section boundary
      if (line.startsWith('## ')) {
        if (current.heading || current.content.length) {
          sections.push({ ...current });
        }
        current = { heading: line.replace(/^## /, ''), content: [] };
        continue;
      }

      current.content.push(line);
    }
    if (current.heading || current.content.length) {
      sections.push(current);
    }

    return sections;
  }

  // Parse key-value pairs from list items
  function parseKV(lines) {
    const obj = {};
    lines.forEach(l => {
      const m = l.replace(/^\s*-\s*/, '').match(/\*\*(.+?)\*\*\s*:\s*(.+)/);
      if (m) obj[m[1]] = m[2].trim();
    });
    return obj;
  }

  // Parse a list of text items (strip bullets)
  function parseList(lines) {
    return lines
      .filter(l => l.trim().startsWith('- '))
      .map(l => l.trim().replace(/^- /, ''));
  }

  // Split content blocks by h3/h4
  function splitByHeader(lines, prefix) {
    const blocks = [];
    let block = null;
    for (const line of lines) {
      if (line.startsWith(prefix + ' ')) {
        if (block) blocks.push(block);
        block = { title: line.replace(prefix + ' ', ''), lines: [] };
      } else if (block) {
        block.lines.push(line);
      }
    }
    if (block) blocks.push(block);
    return blocks;
  }

  // ---- Render functions ----

  function renderHero(section) {
    const lines = section.content;
    let quote = '';
    let tableRows = [];

    // Extract blockquote
    const bqStart = lines.findIndex(l => l.startsWith('> '));
    if (bqStart >= 0) {
      quote = lines[bqStart].replace(/^> /, '');
    }

    // Extract table (stats)
    const tblStart = lines.findIndex(l => l.includes('|'));
    if (tblStart >= 0) {
      // Find all table lines
      const tblLines = [];
      for (let i = tblStart; i < lines.length; i++) {
        if (lines[i].includes('|')) tblLines.push(lines[i]);
        else break;
      }
      if (tblLines.length >= 2) {
        const headers = tblLines[0].split('|').map(s => s.trim()).filter(Boolean);
        const values = tblLines[tblLines.length - 1].split('|').map(s => s.trim()).filter(Boolean);
        tableRows = headers.map((h, i) => ({ label: h, value: values[i] || '' }));
      }
    }

    let html = `<section class="hero" id="hero">
      <h1>${section.heading.replace(/大数据/, '<em>大数据</em>')}</h1>
      <blockquote>${quote}</blockquote>`;

    if (tableRows.length) {
      html += '<table><tr>';
      tableRows.forEach(r => html += `<th>${r.label}</th>`);
      html += '</tr><tr>';
      tableRows.forEach(r => html += `<td>${r.value}</td>`);
      html += '</tr></table>';
    }

    html += '</section>';
    return html;
  }

  function renderResearch(section) {
    const blocks = splitByHeader(section.content, '###');
    let html = `<section class="section" id="research">
      <h2 class="section-title">${section.heading}</h2>
      <div class="grid-2">`;

    blocks.forEach(b => {
      const kv = parseKV(b.lines);
      const desc = b.lines.filter(l => l.trim() && !l.trim().startsWith('- ') && !l.trim().startsWith('###')).join(' ').trim();
      const tags = (kv['标签'] || '').split(' / ');

      html += `<div class="card">
        <span class="icon">${kv['图标'] || ''}</span>
        <h3>${b.title}</h3>
        <p class="desc">${desc}</p>
        <div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>`;
    });

    html += '</div></section>';
    return html;
  }

  function renderMembers(section) {
    const blocks = splitByHeader(section.content, '###');
    let html = `<section class="section" id="members">
      <h2 class="section-title">${section.heading}</h2>
      <div class="grid-4">`;

    blocks.forEach(b => {
      const kv = parseKV(b.lines);
      const desc = kv['简介'] || '';
      const role = kv['职位'] || '';
      const photo = kv['照片'] || '';
      const badge = kv['标签'] || '';
      const links = (kv['链接'] || '').split(' / ');

      const hasImg = photo && !photo.includes('img/');
      const photoHTML = photo && !hasImg
        ? `<img src="${photo}" alt="${b.title}">`
        : `<span style="font-size:2.4rem;opacity:0.3;">👤</span>`;

      html += `<div class="member-card">
        <div class="member-photo">
          ${photoHTML}
          ${badge ? `<span class="member-badge">${badge}</span>` : ''}
        </div>
        <div class="member-info">
          <h3>${b.title}</h3>
          <div class="role">${role}</div>
          <div class="desc">${desc}</div>
          <div class="links">${links.map(l => `<a href="#">${l}</a>`).join('')}</div>
        </div>
      </div>`;
    });

    html += '</div></section>';
    return html;
  }

  function renderPublications(section) {
    const subSections = splitByHeader(section.content, '###');
    let html = `<section class="section" id="publications">
      <h2 class="section-title">${section.heading}</h2>`;

    subSections.forEach(sub => {
      html += `<h3 class="sub-heading">${sub.title}</h3>`;

      if (sub.title.includes('论文')) {
        const papers = splitByHeader(sub.lines, '####');
        papers.forEach(p => {
          const kv = parseKV(p.lines);
          const authors = (kv['作者'] || '').replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>');
          const venue = kv['会议'] || '';
          const plinks = (kv['链接'] || '').split(' / ');

          html += `<div class="pub-item">
            <div class="year">${kv['年份'] || ''}</div>
            <h3>${p.title}</h3>
            <div class="authors">${authors}</div>
            <span class="venue">${venue}</span>
            <div class="pub-links">${plinks.map(l => `<a href="#">${l}</a>`).join('')}</div>
          </div>`;
        });
      }

      if (sub.title.includes('课题')) {
        const projects = splitByHeader(sub.lines, '####');
        html += '<div class="grid-2" style="margin-top:16px;">';
        projects.forEach(p => {
          const kv = parseKV(p.lines);
          // Get description: last non-kv line
          const descLine = p.lines.filter(l => {
            const trimmed = l.trim();
            return trimmed && !trimmed.startsWith('- **') && !trimmed.startsWith('####');
          }).join(' ').trim();
          const tags = (kv['标签'] || '').split(' / ');
          const isActive = (kv['状态'] || '').includes('进行中');

          html += `<div class="project-card">
            <div class="status"><span class="dot${isActive ? '' : ' done'}"></span>${kv['状态'] || ''}</div>
            <h3>${p.title}</h3>
            <p class="desc">${descLine}</p>
            <div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
          </div>`;
        });
        html += '</div>';
      }
    });

    html += '</section>';
    return html;
  }

  function renderTalent(section) {
    const blocks = splitByHeader(section.content, '###');
    let html = `<section class="section" id="talent">
      <h2 class="section-title">${section.heading}</h2>
      <div class="talent-cols">`;

    blocks.forEach((b, i) => {
      const items = parseList(b.lines);
      html += `<div class="talent-card">
        <h3>${b.title}</h3>
        <ul>${items.map(it => `<li>${it}</li>`).join('')}</ul>
      </div>`;

      // Close grid after 2 items, then use full-width
      if (i === 1) html += '</div>';
    });

    html += '</section>';
    return html;
  }

  function renderCulture(section) {
    const lines = section.content;
    let valuesHTML = '';
    let quoteHTML = '';

    // Parse table for values
    const tblStart = lines.findIndex(l => l.includes('|'));
    if (tblStart >= 0) {
      const tblLines = [];
      for (let i = tblStart; i < lines.length; i++) {
        if (lines[i].includes('|')) tblLines.push(lines[i]);
        else break;
      }
      if (tblLines.length >= 3) {
        const headers = tblLines[0].split('|').map(s => s.trim()).filter(Boolean);
        const icons = tblLines[1].split('|').map(s => s.trim()).filter(Boolean);
        const descs = tblLines[2].split('|').map(s => s.trim()).filter(Boolean);

        valuesHTML = '<div class="culture-values">';
        headers.forEach((h, i) => {
          valuesHTML += `<div class="culture-value">
            <div class="icon">${icons[i] || ''}</div>
            <h4>${h}</h4>
            <p>${descs[i] || ''}</p>
          </div>`;
        });
        valuesHTML += '</div>';
      }
    }

    // Blockquote
    const bq = lines.find(l => l.startsWith('> '));
    if (bq) {
      quoteHTML = `<div class="culture-quote">${bq.replace(/^> /, '')}</div>`;
    }

    return `<section class="section" id="culture">
      <h2 class="section-title">${section.heading}</h2>
      ${valuesHTML}
      ${quoteHTML}
    </section>`;
  }

  function renderContact(section) {
    const items = section.content
      .filter(l => l.trim().startsWith('- **'))
      .map(l => {
        const m = l.trim().replace(/^- /, '').match(/\*\*(.+?)\*\*\s*:\s*(.+)/);
        if (m) return { label: m[1], value: m[2].trim() };
        return null;
      })
      .filter(Boolean);

    const bq = section.content.find(l => l.startsWith('> '));
    const noteHTML = bq
      ? `<div class="contact-note">${bq.replace(/^> \*\*[^*]+\*\*\s*:\s*/, '<strong>招生信息：</strong>')}</div>`
      : '';

    let html = `<section class="section" id="contact">
      <h2 class="section-title">${section.heading}</h2>
      <div class="contact-grid">
        <div class="contact-card">
          <h3>联系方式</h3>
          ${items.map(it => `
            <div class="contact-item">
              <div>
                <div class="label">${it.label}</div>
                <div class="value">${it.value}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="contact-card">
          ${noteHTML}
        </div>
      </div>
    </section>`;

    return html;
  }

  // ---- Route sections to renderers ----
  const renderers = {
    '研究方向': renderResearch,
    '团队成员': renderMembers,
    '研究成果': renderPublications,
    '人才培养': renderTalent,
    '团队文化与展望': renderCulture,
    '联系我们': renderContact,
  };

  // ---- Main ----
  const sections = parseMD(md);
  let pageHTML = '';

  sections.forEach(sec => {
    if (sec.heading === 'GML BigData Research Group' || sec.heading.includes('GML')) {
      pageHTML += renderHero(sec);
      return;
    }
    // Find matching renderer
    for (const [key, fn] of Object.entries(renderers)) {
      if (sec.heading.includes(key)) {
        pageHTML += fn(sec);
        return;
      }
    }
  });

  document.getElementById('app').innerHTML = pageHTML;

  // ---- Active nav on scroll ----
  const navAnchors = document.querySelectorAll('.nav-links a');
  const sectionEls = document.querySelectorAll('section[id]');

  function updateNav() {
    const y = window.scrollY + 100;
    sectionEls.forEach(sec => {
      const top = sec.offsetTop;
      const h = sec.offsetHeight;
      const id = sec.id;
      navAnchors.forEach(a => {
        if (a.getAttribute('href') === '#' + id) {
          a.classList.toggle('active', y >= top && y < top + h);
        }
      });
    });
  }
  window.addEventListener('scroll', updateNav, { passive: true });

  // ---- Mobile nav toggle ----
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }

})();
