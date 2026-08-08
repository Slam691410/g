/* ========== Projek Tim: Kanban / Kalender / Tabel + alur tugas ========== */
const Proj = {
  view: DB.get('proj_view', 'kanban'),
  calMonth: null,
  STATUS: ['Backlog', 'Dikerjakan', 'Review', 'Selesai'],
  PRIO: { tinggi: ['Tinggi','b-red'], sedang: ['Sedang','b-yel'], rendah: ['Rendah','b-grn'] },

  tasks(){ return DB.get('tasks', []); },
  save(t){ DB.set('tasks', t); },
  projects(){ return DB.get('projects', ['Umum']); },

  setView(v){ this.view = v; DB.set('proj_view', v); App.navigate(); },

  addProject(){
    const nama = prompt('Nama proyek baru:'); if(!nama) return;
    const ps = this.projects(); if(!ps.includes(nama)) ps.push(nama);
    DB.set('projects', ps); App.navigate();
  },

  openForm(id){
    const t = id ? this.tasks().find(x=>x.id===id) : null;
    Modal.open(`
      <h3>${t?'✏️ Edit Tugas':'＋ Tugas Baru'}</h3>
      <label class="fl">Judul tugas</label><input id="tJudul" value="${t?U.esc(t.judul):''}" placeholder="mis. Desain landing page">
      <label class="fl">Proyek</label>
      <select id="tProj">${this.projects().map(p=>`<option ${t&&t.proj===p?'selected':''}>${U.esc(p)}</option>`).join('')}</select>
      <div class="grid g2">
        <div><label class="fl">Status</label>
          <select id="tStatus">${this.STATUS.map(s=>`<option ${t&&t.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div><label class="fl">Prioritas</label>
          <select id="tPrio">${Object.keys(this.PRIO).map(p=>`<option value="${p}" ${t&&t.prio===p?'selected':''}>${this.PRIO[p][0]}</option>`).join('')}</select></div>
      </div>
      <div class="grid g2">
        <div><label class="fl">Penanggung jawab</label><input id="tPJ" value="${t?U.esc(t.pj||''):''}" placeholder="Nama anggota tim"></div>
        <div><label class="fl">Tenggat</label><input id="tDue" type="date" value="${t&&t.due?t.due:''}"></div>
      </div>
      <label class="fl">Progres (%)</label><input id="tProg" type="number" min="0" max="100" value="${t?t.prog||0:0}">
      <label class="fl">Catatan</label><textarea id="tNote" rows="2">${t?U.esc(t.note||''):''}</textarea>
      <div class="row mt between">
        <button class="btn" onclick="Proj.submit('${id||''}')">${t?'Simpan':'Buat Tugas'}</button>
        ${t?`<button class="btn red" onclick="Proj.del('${id}')">Hapus</button>`:''}
      </div>
      ${t && t.flow && t.flow.length ? `
        <div class="divider"></div>
        <b style="font-size:13px">🔬 Alur tugas (riwayat, bisa diteliti)</b>
        <div class="flow mt">${t.flow.map(f=>`<div class="flow-item"><b>${U.esc(f.aksi)}</b> — <span class="hint">${U.dtm(f.at)}</span>${f.det?`<div class="hint">${U.esc(f.det)}</div>`:''}</div>`).join('')}</div>` : ''}`);
  },
  submit(id){
    const judul = document.getElementById('tJudul').value.trim();
    if(!judul) return Toast.show('Judul wajib diisi');
    const val = {
      judul, proj: document.getElementById('tProj').value, status: document.getElementById('tStatus').value,
      prio: document.getElementById('tPrio').value, pj: document.getElementById('tPJ').value.trim(),
      due: document.getElementById('tDue').value, prog: U.clamp(Number(document.getElementById('tProg').value)||0,0,100),
      note: document.getElementById('tNote').value.trim()
    };
    const ts = this.tasks();
    if(id){
      const t = ts.find(x=>x.id===id);
      const changes = [];
      if(t.status!==val.status) changes.push(`Status: ${t.status} → ${val.status}`);
      if(t.prio!==val.prio) changes.push(`Prioritas: ${t.prio} → ${val.prio}`);
      if(t.prog!==val.prog) changes.push(`Progres: ${t.prog}% → ${val.prog}%`);
      Object.assign(t, val);
      t.flow.push({ at: new Date().toISOString(), aksi: 'Diperbarui', det: changes.join('; ') || 'Detail tugas diubah' });
      if(val.status==='Selesai' && val.prog<100){ t.prog = 100; }
    } else {
      ts.unshift(Object.assign({ id: U.uid(), at: new Date().toISOString(),
        flow: [{ at: new Date().toISOString(), aksi: 'Tugas dibuat', det: 'Masuk ' + val.status }] }, val));
    }
    this.save(ts); Modal.close(); Toast.show('Tersimpan ✔'); App.navigate();
  },
  del(id){ if(!confirm('Hapus tugas?')) return; this.save(this.tasks().filter(t=>t.id!==id)); Modal.close(); App.navigate(); },

  move(id, status){
    const ts = this.tasks(); const t = ts.find(x=>x.id===id);
    if(t && t.status!==status){
      t.flow.push({ at: new Date().toISOString(), aksi: 'Dipindah', det: t.status + ' → ' + status });
      t.status = status;
      if(status==='Selesai') t.prog = 100;
      this.save(ts);
    }
    App.navigate();
  },
  shiftCal(d){ const m = this.calMonth || new Date(); this.calMonth = new Date(m.getFullYear(), m.getMonth()+d, 1); App.navigate(); }
};

App.register('project', 'Projek Tim', function(el){
  const ts = Proj.tasks();
  const done = ts.filter(t=>t.status==='Selesai').length;
  const overdue = ts.filter(t=>t.due && t.status!=='Selesai' && new Date(t.due) < new Date()).length;

  let body = '';
  if(Proj.view==='kanban'){
    body = `<div class="kanban">` + Proj.STATUS.map(s=>{
      const col = ts.filter(t=>t.status===s);
      return `<div class="kcol" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')"
        ondrop="this.classList.remove('dragover');Proj.move(event.dataTransfer.getData('id'),'${s}')">
        <div class="kcol-head"><span>${s}</span><span class="badge b-mut">${col.length}</span></div>
        ${col.map(t=>kcard(t)).join('')}
      </div>`; }).join('') + `</div>`;
  }
  else if(Proj.view==='kalender'){
    const m = Proj.calMonth || new Date();
    const y = m.getFullYear(), mo = m.getMonth();
    const first = new Date(y, mo, 1); const start = (first.getDay()+6)%7; // Senin awal
    const days = new Date(y, mo+1, 0).getDate();
    const today = new Date();
    let cells = '';
    for(let i=0;i<start;i++) cells += `<div></div>`;
    for(let d=1; d<=days; d++){
      const iso = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = ts.filter(t=>t.due===iso);
      const isToday = today.getFullYear()===y && today.getMonth()===mo && today.getDate()===d;
      cells += `<div class="cal-cell ${isToday?'today':''}"><div class="d">${d}</div>
        ${dayTasks.map(t=>`<div class="cal-task" onclick="Proj.openForm('${t.id}')" title="${U.esc(t.judul)}">${U.esc(t.judul)}</div>`).join('')}</div>`;
    }
    body = `
      <div class="row between mb">
        <button class="btn ghost sm" onclick="Proj.shiftCal(-1)">← Bulan lalu</button>
        <b>${U.months[mo]} ${y}</b>
        <button class="btn ghost sm" onclick="Proj.shiftCal(1)">Bulan depan →</button>
      </div>
      <div class="cal">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>`<div class="cal-head">${d}</div>`).join('')}${cells}</div>`;
  }
  else {
    body = ts.length ? `<div class="card" style="overflow-x:auto"><table>
      <tr><th>Tugas</th><th>Proyek</th><th>Status</th><th>Prioritas</th><th>PJ</th><th>Tenggat</th><th>Progres</th><th>Alur</th></tr>
      ${ts.map(t=>`<tr style="cursor:pointer" onclick="Proj.openForm('${t.id}')">
        <td><b>${U.esc(t.judul)}</b></td><td>${U.esc(t.proj)}</td>
        <td><span class="badge ${t.status==='Selesai'?'b-grn':t.status==='Dikerjakan'?'b-pri':t.status==='Review'?'b-cyn':'b-mut'}">${t.status}</span></td>
        <td><span class="badge ${Proj.PRIO[t.prio][1]}">${Proj.PRIO[t.prio][0]}</span></td>
        <td>${U.esc(t.pj||'—')}</td>
        <td>${t.due ? (new Date(t.due)<new Date() && t.status!=='Selesai' ? `<span class="down">${U.dt(t.due)} ⚠</span>` : U.dt(t.due)) : '—'}</td>
        <td style="min-width:110px"><div class="bar-wrap"><div class="bar" style="width:${t.prog||0}%"></div></div><span class="hint">${t.prog||0}%</span></td>
        <td class="hint">${t.flow.length} langkah</td>
      </tr>`).join('')}</table></div>` : `<div class="empty">Belum ada tugas.</div>`;
  }

  el.innerHTML = `
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">Total Tugas</div><div class="val">${ts.length}</div></div>
      <div class="stat"><div class="lbl">Selesai</div><div class="val up">${done}</div></div>
      <div class="stat"><div class="lbl">Terlambat</div><div class="val ${overdue?'down':''}">${overdue}</div></div>
      <div class="stat"><div class="lbl">Proyek</div><div class="val">${Proj.projects().length}</div></div>
    </div>
    <div class="row between mb wrap">
      <div class="tabs" style="margin:0">
        <button class="tab ${Proj.view==='kanban'?'active':''}" onclick="Proj.setView('kanban')">🗂 Kanban</button>
        <button class="tab ${Proj.view==='kalender'?'active':''}" onclick="Proj.setView('kalender')">📆 Kalender</button>
        <button class="tab ${Proj.view==='tabel'?'active':''}" onclick="Proj.setView('tabel')">📊 Tabel</button>
      </div>
      <div class="row">
        <button class="btn ghost sm" onclick="Proj.addProject()">＋ Proyek</button>
        <button class="btn sm" onclick="Proj.openForm()">＋ Tugas</button>
      </div>
    </div>
    ${body}`;

  function kcard(t){
    const overdueT = t.due && t.status!=='Selesai' && new Date(t.due)<new Date();
    return `<div class="kcard" draggable="true" ondragstart="event.dataTransfer.setData('id','${t.id}')" onclick="Proj.openForm('${t.id}')">
      <div class="row between"><b>${U.esc(t.judul)}</b><span class="badge ${Proj.PRIO[t.prio][1]}">${Proj.PRIO[t.prio][0]}</span></div>
      <div class="hint mts">${U.esc(t.proj)}${t.pj?` · ${U.esc(t.pj)}`:''}${t.due?` · ${overdueT?'⚠ ':''}${U.dt(t.due)}`:''}</div>
      <div class="bar-wrap mts"><div class="bar" style="width:${t.prog||0}%"></div></div>
    </div>`;
  }
});
