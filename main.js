import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = 'https://pbpspiavtihqgdigedvn.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uhM6t2Uw1vh2wHYCDx9tzg_ly3nXAqx'
const url = String(import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL).trim()
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY).trim()
const supabase = createClient(url, key)
const app = document.querySelector('#app')

const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const money = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const isoDate = d => d ? String(d).slice(0,10) : ''
const statusOS = ['Aberta','Agendada','Em andamento','Aguardando','Concluída','Cancelada']
const statusAgenda = ['Agendado','Confirmado','Em andamento','Concluído','Cancelado','Não compareceu']
const prioridades = ['Baixa','Normal','Alta','Urgente']
const pagamentosStatus = ['Pendente','Parcial','Pago','Cancelado']

async function getMe(user) {
  const { data, error } = await supabase.from('usuarios').select('id,nome,perfil_id,ativo,perfis(id,nome,descricao)').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {...data, perfil: Array.isArray(data.perfis) ? data.perfis[0] : data.perfis}
}

function shell(me, content) {
  app.innerHTML = `<div class="layout"><aside class="sidebar">
    <div class="brand"><div class="brand-mark">TS</div><div><strong>TS Refrigeração</strong><small>Sistema Online</small></div></div>
    <nav>
      <button data-page="dashboard">📊 Dashboard</button><button data-page="clientes">👥 Clientes</button><button data-page="agenda">📅 Agenda</button>
      <button data-page="os">🧾 Ordens de serviço</button><button data-page="financeiro">💰 Financeiro</button><button data-page="servicos">🛠️ Serviços</button><button data-page="usuarios">👤 Usuários</button>
    </nav>
    <div class="userbox"><b>${esc(me.nome)}</b><span>${esc(me.perfil?.nome || '')}</span><button id="logout">Sair</button></div>
  </aside><section class="main"><header><div><h2 id="page-title">Dashboard</h2><span id="status">Conectado ao Supabase</span></div><button class="mobile-menu" id="mobileMenu">☰</button></header><div id="content">${content}</div></section></div>`
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => loadPage(b.dataset.page)))
  document.querySelector('#logout')?.addEventListener('click', async () => { await supabase.auth.signOut() })
  document.querySelector('#mobileMenu')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'))
}

function table(rows, heads) { return `<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` }
function formSelect(id, values, selected='') { return `<select id="${id}">${values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('')}</select>` }

async function loadPage(page) {
  const {data:{user}} = await supabase.auth.getUser(); if (!user) return
  const me = await getMe(user); if (!me || !me.ativo) return login('Usuário sem cadastro ativo no sistema.')
  const titles={dashboard:'Dashboard',clientes:'Clientes',agenda:'Agenda',os:'Ordens de serviço',financeiro:'Financeiro',servicos:'Serviços',usuarios:'Usuários'}
  document.querySelector('#page-title').textContent=titles[page]||'Dashboard'
  const c=document.querySelector('#content'); c.innerHTML='<div class="loading">Carregando...</div>'
  try {
    if(page==='dashboard') await dashboard(c)
    else if(page==='clientes') await clientes(c)
    else if(page==='agenda') await agenda(c)
    else if(page==='os') await ordens(c)
    else if(page==='financeiro') await financeiro(c)
    else if(page==='servicos') await servicos(c)
    else if(page==='usuarios') await usuarios(c, me)
  } catch(e) { c.innerHTML=`<div class="error"><b>Erro:</b> ${esc(e.message)}</div>` }
}

async function dashboard(c) {
  const [cli,os,ag,pay]=await Promise.all([
    supabase.from('clientes').select('id',{count:'exact',head:true}),
    supabase.from('ordens_servico').select('id,valor_total,status'),
    supabase.from('agendamentos').select('id',{count:'exact',head:true}),
    supabase.from('pagamentos').select('valor')
  ])
  if(cli.error) throw cli.error; if(os.error) throw os.error; if(ag.error) throw ag.error; if(pay.error) throw pay.error
  const totalOS=(os.data||[]).reduce((s,r)=>s+Number(r.valor_total||0),0)
  const recebido=(pay.data||[]).reduce((s,r)=>s+Number(r.valor||0),0)
  const abertas=(os.data||[]).filter(r=>!['Concluída','Cancelada'].includes(r.status)).length
  c.innerHTML=`<div class="hero"><div><h1>Olá! 👋</h1><p>Acesso completo aos módulos da TS Refrigeração.</p></div><button class="primary" id="newDashOS">+ Nova OS</button></div>
  <div class="cards"><div class="card"><span>Clientes</span><b>${cli.count||0}</b></div><div class="card"><span>OS abertas</span><b>${abertas}</b></div><div class="card"><span>Agendamentos</span><b>${ag.count||0}</b></div><div class="card"><span>Total das OS</span><b>${money(totalOS)}</b></div><div class="card"><span>Recebido</span><b>${money(recebido)}</b></div></div>
  <div class="panel"><h3>Acesso aos módulos</h3><p>Use o menu lateral para consultar e operar Clientes, Agenda, Ordens de Serviço, Financeiro, Serviços e Usuários.</p></div>`
  document.querySelector('#newDashOS')?.addEventListener('click',()=>osForm())
}

async function clientes(c) {
  const {data,error}=await supabase.from('clientes').select('*').eq('ativo',true).order('nome'); if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="search" placeholder="Buscar cliente..."><button class="primary" id="add">+ Novo cliente</button></div><div id="clientTable"></div>`
  const render=(filter='')=>{const list=(data||[]).filter(x=>`${x.nome} ${x.telefone||''} ${x.cpf_cnpj||''}`.toLowerCase().includes(filter.toLowerCase())); document.querySelector('#clientTable').innerHTML=table(list.map(x=>`<tr><td><b>${esc(x.nome)}</b><small>${esc(x.cpf_cnpj||'')}</small></td><td>${esc(x.telefone||x.whatsapp||'')}</td><td>${esc(x.cidade||'')}/${esc(x.estado||'')}</td><td><button class="link" data-edit="${x.id}">Editar</button> <button class="danger-link" data-del="${x.id}">Excluir</button></td></tr>`),['Cliente','Telefone','Local','Ações']); bindClientActions(data||[])}
  const bindClientActions=list=>{document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>clientForm(list.find(x=>x.id===b.dataset.edit)));document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Excluir este cliente definitivamente?'))return;const {error}=await supabase.from('clientes').delete().eq('id',b.dataset.del);if(error)alert(error.message);else loadPage('clientes')})}
  render(); document.querySelector('#search').oninput=e=>render(e.target.value); document.querySelector('#add').onclick=()=>clientForm()
}

function clientForm(x={}) {
  const c=document.querySelector('#content'); const tipo=x.tipo_pessoa||'Física'
  c.innerHTML=`<div class="panel form"><h3>${x.id?'Editar':'Novo'} cliente</h3><div class="grid2">
  <label>Nome*<input id="nome" value="${esc(x.nome)}"></label><label>Tipo<select id="tipo"><option value="Física" ${tipo==='Física'?'selected':''}>Física</option><option value="Jurídica" ${tipo==='Jurídica'?'selected':''}>Jurídica</option></select></label>
  <label>CPF/CNPJ<input id="doc" value="${esc(x.cpf_cnpj)}"></label><label>Telefone<input id="tel" value="${esc(x.telefone)}"></label><label>WhatsApp<input id="zap" value="${esc(x.whatsapp)}"></label><label>E-mail<input id="email" value="${esc(x.email)}"></label>
  <label>CEP<input id="cep" value="${esc(x.cep)}"></label><label>Endereço<input id="end" value="${esc(x.endereco)}"></label><label>Número<input id="num" value="${esc(x.numero)}"></label><label>Complemento<input id="comp" value="${esc(x.complemento)}"></label><label>Bairro<input id="bairro" value="${esc(x.bairro)}"></label><label>Cidade<input id="cidade" value="${esc(x.cidade)}"></label><label>Estado<input id="estado" maxlength="2" value="${esc(x.estado)}"></label>
  </div><div class="actions"><button class="secondary" id="cancel">Cancelar</button><button class="primary" id="save">Salvar cliente</button></div></div>`
  document.querySelector('#cancel').onclick=()=>loadPage('clientes')
  document.querySelector('#save').onclick=async()=>{const {data:{user}}=await supabase.auth.getUser();const payload={tipo_pessoa:document.querySelector('#tipo').value,nome:document.querySelector('#nome').value.trim(),cpf_cnpj:document.querySelector('#doc').value,telefone:document.querySelector('#tel').value,whatsapp:document.querySelector('#zap').value,email:document.querySelector('#email').value,cep:document.querySelector('#cep').value,endereco:document.querySelector('#end').value,numero:document.querySelector('#num').value,complemento:document.querySelector('#comp').value,bairro:document.querySelector('#bairro').value,cidade:document.querySelector('#cidade').value,estado:document.querySelector('#estado').value,ativo:true,criado_por:user?.id};if(!payload.nome)return alert('Informe o nome.');const q=x.id?supabase.from('clientes').update(payload).eq('id',x.id):supabase.from('clientes').insert(payload);const {error}=await q;if(error)return alert(error.message);loadPage('clientes')}
}

async function agenda(c) {
  const {data,error}=await supabase.from('agendamentos').select('*,clientes(id,nome),tecnico:usuarios!agendamentos_tecnico_id_fkey(id,nome),equipamentos(id,tipo,marca,modelo)').order('data_agendamento').order('hora_inicio'); if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="agendaSearch" placeholder="Buscar cliente ou serviço..."><button class="primary" id="newAgenda">+ Novo agendamento</button></div><div id="agendaTable"></div>`
  const render=f=>{const list=(data||[]).filter(x=>`${x.clientes?.nome||''} ${x.tipo_servico||''} ${x.status||''}`.toLowerCase().includes((f||'').toLowerCase()));document.querySelector('#agendaTable').innerHTML=table(list.map(x=>`<tr><td>${esc(x.data_agendamento)} ${esc(x.hora_inicio?.slice(0,5)||'')}</td><td>${esc(x.clientes?.nome||'')}</td><td>${esc(x.tipo_servico||'')}</td><td>${esc(x.tecnico?.nome||'')}</td><td><span class="badge">${esc(x.status||'')}</span></td><td><button class="link" data-ag="${x.id}">Editar</button></td></tr>`),['Data/Hora','Cliente','Serviço','Técnico','Status','Ações']);document.querySelectorAll('[data-ag]').forEach(b=>b.onclick=()=>agendaForm(list.find(x=>x.id===b.dataset.ag)))}
  render(''); document.querySelector('#agendaSearch').oninput=e=>render(e.target.value); document.querySelector('#newAgenda').onclick=()=>agendaForm()
}

async function agendaForm(x={}) {
  const [{data:clients},{data:techs}]=await Promise.all([supabase.from('clientes').select('id,nome').eq('ativo',true).order('nome'),supabase.from('usuarios').select('id,nome').eq('ativo',true).order('nome')])
  const c=document.querySelector('#content'); c.innerHTML=`<div class="panel form"><h3>${x.id?'Editar':'Novo'} agendamento</h3><div class="grid2">
  <label>Cliente*<select id="agCliente"><option value="">Selecione</option>${(clients||[]).map(v=>`<option value="${v.id}" ${v.id===x.cliente_id?'selected':''}>${esc(v.nome)}</option>`).join('')}</select></label>
  <label>Técnico<select id="agTech"><option value="">Selecione</option>${(techs||[]).map(v=>`<option value="${v.id}" ${v.id===x.tecnico_id?'selected':''}>${esc(v.nome)}</option>`).join('')}</select></label>
  <label>Data*<input id="agDate" type="date" value="${esc(isoDate(x.data_agendamento))}"></label><label>Hora início<input id="agStart" type="time" value="${esc(x.hora_inicio?.slice(0,5)||'')}"></label><label>Hora fim<input id="agEnd" type="time" value="${esc(x.hora_fim?.slice(0,5)||'')}"></label><label>Tipo de serviço<input id="agType" value="${esc(x.tipo_servico)}"></label><label>Status${formSelect('agStatus',statusAgenda,x.status||'Agendado')}</label><label class="wide">Observações<textarea id="agObs">${esc(x.observacoes)}</textarea></label>
  </div><div class="actions"><button class="secondary" id="back">Cancelar</button><button class="primary" id="saveAg">Salvar agendamento</button></div></div>`
  document.querySelector('#back').onclick=()=>loadPage('agenda'); document.querySelector('#saveAg').onclick=async()=>{const {data:{user}}=await supabase.auth.getUser();const payload={cliente_id:document.querySelector('#agCliente').value,equipamento_id:x.equipamento_id||null,tecnico_id:document.querySelector('#agTech').value||null,data_agendamento:document.querySelector('#agDate').value,hora_inicio:document.querySelector('#agStart').value||null,hora_fim:document.querySelector('#agEnd').value||null,tipo_servico:document.querySelector('#agType').value,status:document.querySelector('#agStatus').value,observacoes:document.querySelector('#agObs').value,criado_por:x.criado_por||user?.id};if(!payload.cliente_id||!payload.data_agendamento)return alert('Cliente e data são obrigatórios.');const q=x.id?supabase.from('agendamentos').update(payload).eq('id',x.id):supabase.from('agendamentos').insert(payload);const {error}=await q;if(error)return alert(error.message);loadPage('agenda')}
}

async function ordens(c) {
  const {data,error}=await supabase.from('ordens_servico').select('*,clientes(id,nome),tecnico:usuarios!ordens_servico_tecnico_id_fkey(id,nome),criado_por_usuario:usuarios!ordens_servico_criado_por_fkey(id,nome)').order('criado_em',{ascending:false}).limit(200); if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="ossearch" placeholder="Buscar número, cliente ou status..."><button class="primary" id="newos">+ Nova OS</button></div><div id="ostable"></div>`
  const render=f=>{const list=(data||[]).filter(x=>`${x.numero} ${x.clientes?.nome||''} ${x.status||''}`.toLowerCase().includes((f||'').toLowerCase()));document.querySelector('#ostable').innerHTML=table(list.map(x=>`<tr><td><b>#${x.numero||''}</b></td><td>${esc(x.clientes?.nome||'')}</td><td><span class="badge">${esc(x.status||'')}</span></td><td>${money(x.valor_total)}</td><td><button class="link" data-os="${x.id}">Abrir / Editar</button></td></tr>`),['OS','Cliente','Status','Total','Ações']);document.querySelectorAll('[data-os]').forEach(b=>b.onclick=()=>osForm(list.find(x=>x.id===b.dataset.os)))}
  render('');document.querySelector('#ossearch').oninput=e=>render(e.target.value);document.querySelector('#newos').onclick=()=>osForm()
}

async function osForm(x={}) {
  const [{data:clients},{data:techs}]=await Promise.all([supabase.from('clientes').select('id,nome').eq('ativo',true).order('nome'),supabase.from('usuarios').select('id,nome').eq('ativo',true).order('nome')])
  const c=document.querySelector('#content'); c.innerHTML=`<div class="panel form"><div class="detail-head"><h3>${x.id?`OS #${x.numero} — Editar`:'Nova ordem de serviço'}</h3>${x.id?`<span class="badge">${esc(x.status)}</span>`:''}</div><div class="grid2">
  <label>Cliente*<select id="osClient"><option value="">Selecione</option>${(clients||[]).map(v=>`<option value="${v.id}" ${v.id===x.cliente_id?'selected':''}>${esc(v.nome)}</option>`).join('')}</select></label>
  <label>Técnico<select id="osTech"><option value="">Selecione</option>${(techs||[]).map(v=>`<option value="${v.id}" ${v.id===x.tecnico_id?'selected':''}>${esc(v.nome)}</option>`).join('')}</select></label>
  <label>Status${formSelect('osStatus',statusOS,x.status||'Aberta')}</label><label>Prioridade${formSelect('osPriority',prioridades,x.prioridade||'Normal')}</label>
  <label>Valor dos serviços<input id="osValorServ" type="number" step="0.01" value="${Number(x.valor_servicos||0)}"></label><label>Valor das peças<input id="osValorPecas" type="number" step="0.01" value="${Number(x.valor_pecas||0)}"></label><label>Desconto<input id="osDesc" type="number" step="0.01" value="${Number(x.desconto||0)}"></label>
  <label>Status financeiro${formSelect('osPayStatus',pagamentosStatus,x.pagamento_status||'Pendente')}</label><label>Forma de pagamento<input id="osForma" value="${esc(x.forma_pagamento)}"></label>
  <label class="wide">Problema relatado<textarea id="osProblem">${esc(x.problema_relatado)}</textarea></label><label class="wide">Diagnóstico<textarea id="osDiag">${esc(x.diagnostico)}</textarea></label><label class="wide">Serviço executado<textarea id="osExec">${esc(x.servico_executado)}</textarea></label><label class="wide">Observações<textarea id="osObs">${esc(x.observacoes)}</textarea></label>
  </div><div class="actions"><button class="secondary" id="osBack">Cancelar</button>${x.id&&x.status!=='Concluída'&&x.status!=='Cancelada'?'<button class="secondary" id="closeOS">Fechar OS</button>':''}<button class="primary" id="saveOS">${x.id?'Salvar alterações':'Criar OS'}</button></div></div>`
  const collect=()=>{const {data:{user}}=supabase.auth.getSession();return {cliente_id:document.querySelector('#osClient').value,tecnico_id:document.querySelector('#osTech').value||null,status:document.querySelector('#osStatus').value,prioridade:document.querySelector('#osPriority').value,valor_servicos:Number(document.querySelector('#osValorServ').value||0),valor_pecas:Number(document.querySelector('#osValorPecas').value||0),desconto:Number(document.querySelector('#osDesc').value||0),pagamento_status:document.querySelector('#osPayStatus').value,forma_pagamento:document.querySelector('#osForma').value,problema_relatado:document.querySelector('#osProblem').value,diagnostico:document.querySelector('#osDiag').value,servico_executado:document.querySelector('#osExec').value,observacoes:document.querySelector('#osObs').value}}
  document.querySelector('#osBack').onclick=()=>loadPage('os')
  document.querySelector('#saveOS').onclick=async()=>{const {data:{user}}=await supabase.auth.getUser();const payload=collect();payload.criado_por=x.criado_por||user?.id;if(!payload.cliente_id)return alert('Selecione o cliente.');if(payload.status==='Concluída'&&!x.data_conclusao)payload.data_conclusao=new Date().toISOString();const q=x.id?supabase.from('ordens_servico').update(payload).eq('id',x.id):supabase.from('ordens_servico').insert(payload).select().single();const {data,error}=await q;if(error)return alert(error.message);if(!x.id)alert(`OS #${data.numero} criada com sucesso.`);loadPage('os')}
  document.querySelector('#closeOS')?.addEventListener('click',async()=>{if(!confirm('Fechar esta OS e atualizar o financeiro conforme o status de pagamento?'))return;const {data:{user}}=await supabase.auth.getUser();const payload=collect();payload.status='Concluída';payload.data_conclusao=new Date().toISOString();payload.criado_por=x.criado_por||user?.id;const {error}=await supabase.from('ordens_servico').update(payload).eq('id',x.id);if(error)return alert(error.message);alert('OS fechada. O financeiro foi integrado automaticamente quando aplicável.');loadPage('os')})
}

async function financeiro(c) {
  const {data,error}=await supabase.from('pagamentos').select('*,ordens_servico(numero,cliente_id,clientes(nome))').order('data_pagamento',{ascending:false}).limit(300);if(error)throw error
  const total=(data||[]).reduce((s,x)=>s+Number(x.valor||0),0)
  c.innerHTML=`<div class="cards"><div class="card"><span>Recebimentos</span><b>${money(total)}</b></div><div class="card"><span>Lançamentos</span><b>${data?.length||0}</b></div></div><div class="toolbar"><button class="primary" id="newPay">+ Novo lançamento</button></div><div id="payTable"></div>`
  document.querySelector('#payTable').innerHTML=table((data||[]).map(x=>`<tr><td>${esc(x.ordens_servico?.numero||'')}</td><td>${esc(x.ordens_servico?.clientes?.nome||'')}</td><td>${esc(x.forma_pagamento||'')}</td><td>${money(x.valor)}</td><td>${esc(isoDate(x.data_pagamento))}</td><td><button class="link" data-pay="${x.id}">Editar</button></td></tr>`),['OS','Cliente','Forma','Valor','Data','Ações'])
  document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>paymentForm((data||[]).find(x=>x.id===b.dataset.pay)))
  document.querySelector('#newPay').onclick=()=>paymentForm()
}

async function paymentForm(x={}) {
  const {data:os}=await supabase.from('ordens_servico').select('id,numero,clientes(nome)').order('numero',{ascending:false}).limit(300)
  const c=document.querySelector('#content');c.innerHTML=`<div class="panel form"><h3>${x.id?'Editar lançamento':'Novo lançamento financeiro'}</h3><div class="grid2"><label>OS<select id="payOS"><option value="">Sem OS</option>${(os||[]).map(v=>`<option value="${v.id}" ${v.id===x.os_id?'selected':''}>#${v.numero} — ${esc(v.clientes?.nome||'')}</option>`).join('')}</select></label><label>Valor<input id="payValue" type="number" step="0.01" value="${Number(x.valor||0)}"></label><label>Forma de pagamento<input id="payForma" value="${esc(x.forma_pagamento)}"></label><label>Data<input id="payDate" type="date" value="${esc(isoDate(x.data_pagamento)||isoDate(new Date().toISOString()))}"></label><label class="wide">Observações<textarea id="payObs">${esc(x.observacoes)}</textarea></label></div><div class="actions"><button class="secondary" id="payBack">Cancelar</button><button class="primary" id="paySave">Salvar lançamento</button></div></div>`
  document.querySelector('#payBack').onclick=()=>loadPage('financeiro');document.querySelector('#paySave').onclick=async()=>{const {data:{user}}=await supabase.auth.getUser();const payload={os_id:document.querySelector('#payOS').value||null,valor:Number(document.querySelector('#payValue').value||0),forma_pagamento:document.querySelector('#payForma').value,data_pagamento:document.querySelector('#payDate').value,observacoes:document.querySelector('#payObs').value,criado_por:x.criado_por||user?.id};if(payload.valor<=0)return alert('Informe um valor maior que zero.');const q=x.id?supabase.from('pagamentos').update(payload).eq('id',x.id):supabase.from('pagamentos').insert(payload);const {error}=await q;if(error)return alert(error.message);loadPage('financeiro')}
}

async function servicos(c) {
  const {data,error}=await supabase.from('servicos').select('*').order('nome');if(error)throw error
  c.innerHTML=`<div class="toolbar"><button class="primary" id="addsvc">+ Novo serviço</button></div>${table((data||[]).map(x=>`<tr><td><b>${esc(x.nome)}</b><small>${esc(x.descricao||'')}</small></td><td>${money(x.valor_padrao)}</td><td><span class="badge">${x.ativo?'Ativo':'Inativo'}</span></td><td><button class="link" data-svc="${x.id}">Editar</button></td></tr>`),['Serviço','Valor padrão','Status','Ações'])}`
  document.querySelector('#addsvc').onclick=()=>serviceForm();document.querySelectorAll('[data-svc]').forEach(b=>b.onclick=()=>serviceForm((data||[]).find(x=>x.id===b.dataset.svc)))
}

function serviceForm(x={}) {
  const c=document.querySelector('#content');c.innerHTML=`<div class="panel form"><h3>${x.id?'Editar':'Novo'} serviço</h3><div class="grid2"><label>Nome*<input id="svcNome" value="${esc(x.nome)}"></label><label>Valor padrão<input id="svcValor" type="number" step="0.01" value="${Number(x.valor_padrao||0)}"></label><label class="wide">Descrição<textarea id="svcDesc">${esc(x.descricao)}</textarea></label><label>Status<select id="svcAtivo"><option value="true" ${x.ativo!==false?'selected':''}>Ativo</option><option value="false" ${x.ativo===false?'selected':''}>Inativo</option></select></label></div><div class="actions"><button class="secondary" id="svcBack">Cancelar</button><button class="primary" id="svcSave">Salvar serviço</button></div></div>`
  document.querySelector('#svcBack').onclick=()=>loadPage('servicos');document.querySelector('#svcSave').onclick=async()=>{const payload={nome:document.querySelector('#svcNome').value.trim(),descricao:document.querySelector('#svcDesc').value,valor_padrao:Number(document.querySelector('#svcValor').value||0),ativo:document.querySelector('#svcAtivo').value==='true'};if(!payload.nome)return alert('Informe o nome do serviço.');const q=x.id?supabase.from('servicos').update(payload).eq('id',x.id):supabase.from('servicos').insert(payload);const {error}=await q;if(error)return alert(error.message);loadPage('servicos')}
}

async function usuarios(c, me) {
  const [{data,error},{data:perfis}]=await Promise.all([supabase.from('usuarios').select('id,nome,telefone,ativo,perfil_id,perfis(id,nome)').order('nome'),supabase.from('perfis').select('id,nome').eq('ativo',true).order('nome')]);if(error)throw error
  const admin=me.perfil?.nome==='Administrador'
  c.innerHTML=`<div class="notice">${admin?'O administrador pode criar, editar, ativar/desativar e excluir sub-usuários. A senha é criada no cadastro e o acesso é imediato.':'Você pode consultar os usuários cadastrados. O gerenciamento de sub-usuários fica disponível para o Administrador.'}</div>${admin?'<div class="toolbar"><button class="primary" id="newUser">+ Novo sub-usuário</button></div>':''}${table((data||[]).map(x=>`<tr><td><b>${esc(x.nome)}</b></td><td>${esc(x.telefone||'')}</td><td>${esc(Array.isArray(x.perfis)?x.perfis[0]?.nome:x.perfis?.nome||'')}</td><td><span class="badge">${x.ativo?'Ativo':'Inativo'}</span></td><td>${admin?`<button class="link" data-user="${x.id}">Editar</button> <button class="danger-link" data-userdel="${x.id}">Excluir</button>`:''}</td></tr>`),['Usuário','Telefone','Perfil','Status','Ações'])}`
  if(admin){document.querySelector('#newUser').onclick=()=>userForm(null,perfis||[]);document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>userForm((data||[]).find(x=>x.id===b.dataset.user),perfis||[]));document.querySelectorAll('[data-userdel]').forEach(b=>b.onclick=async()=>{if(b.dataset.userdel===me.id)return alert('O administrador atual não pode ser excluído.');if(!confirm('Excluir este sub-usuário também do acesso ao sistema?'))return;const {error}=await supabase.functions.invoke('gerenciar-subusuarios',{body:{action:'delete',id:b.dataset.userdel}});if(error)return alert(error.message);loadPage('usuarios')})}
}

function userForm(x, perfis) {
  const c=document.querySelector('#content');c.innerHTML=`<div class="panel form"><h3>${x?'Editar':'Novo'} sub-usuário</h3><div class="grid2"><label>Nome*<input id="uNome" value="${esc(x?.nome)}"></label><label>Telefone<input id="uTel" value="${esc(x?.telefone)}"></label><label>E-mail*${x?`<input value="Gerenciado pelo Supabase Auth" disabled>`:`<input id="uEmail" type="email">`}</label><label>${x?'Nova senha (opcional)':'Senha*'}<input id="uPass" type="password" placeholder="Mínimo 6 caracteres" ${x?'':'required'}></label><label>Perfil<select id="uPerfil">${(perfis||[]).map(p=>`<option value="${p.id}" ${p.id===x?.perfil_id?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></label><label>Status<select id="uAtivo"><option value="true" ${x?.ativo!==false?'selected':''}>Ativo</option><option value="false" ${x?.ativo===false?'selected':''}>Inativo</option></select></label></div><div class="actions"><button class="secondary" id="uBack">Cancelar</button><button class="primary" id="uSave">Salvar usuário</button></div></div>`
  document.querySelector('#uBack').onclick=()=>loadPage('usuarios');document.querySelector('#uSave').onclick=async()=>{const body=x?{action:'update',id:x.id,nome:document.querySelector('#uNome').value.trim(),telefone:document.querySelector('#uTel').value,perfil_id:document.querySelector('#uPerfil').value,ativo:document.querySelector('#uAtivo').value==='true'}:{action:'create',nome:document.querySelector('#uNome').value.trim(),telefone:document.querySelector('#uTel').value,email:document.querySelector('#uEmail').value.trim(),password:document.querySelector('#uPass').value,perfil_id:document.querySelector('#uPerfil').value};if(!body.nome)return alert('Informe o nome.');if(!x&&!body.email)return alert('Informe o e-mail.');if(!x&&body.password.length<6)return alert('A senha deve ter pelo menos 6 caracteres.');const {data,error}=await supabase.functions.invoke('gerenciar-subusuarios',{body});if(error)return alert(error.message);if(data?.error)return alert(data.error);alert(x?'Usuário atualizado.':'Sub-usuário criado com sucesso.');loadPage('usuarios')}
}

function login(msg='') { app.innerHTML=`<main class="login"><div class="login-card"><div class="brand center"><div class="brand-mark">TS</div><div><strong>TS Refrigeração</strong><small>Gestão de serviços</small></div></div><h1>Acesso ao sistema</h1>${msg?`<div class="error">${esc(msg)}</div>`:''}<label>E-mail<input id="email" type="email" autocomplete="username"></label><label>Senha<input id="password" type="password" autocomplete="current-password"></label><button class="primary full" id="login">Entrar</button><p class="hint">A autenticação é feita pelo Supabase.</p></div></main>`
  document.querySelector('#login').onclick=async()=>{const email=document.querySelector('#email').value,password=document.querySelector('#password').value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error)return login(error.message);boot()}
}
async function boot(){const {data:{session}}=await supabase.auth.getSession();if(!session)return login();const me=await getMe(session.user);if(!me)return login('Seu usuário Auth ainda não está associado à tabela usuarios.');if(!me.ativo)return login('Seu usuário está inativo.');shell(me,'<div class="loading">Carregando...</div>');await loadPage('dashboard')}
supabase.auth.onAuthStateChange((_event,session)=>{if(!session)login()})
boot()
