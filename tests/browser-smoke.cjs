'use strict';

/**
 * TR Beauty Concept browser smoke test. Runs only against a local, disposable
 * Expo web export with fake Supabase data — never signs in to production.
 * Requires NODE_PATH pointing at a globally installed, pinned playwright.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'dist');
const artifacts = path.resolve(__dirname, '..', 'test-artifacts');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
};
const testServices = [{
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Banho de Gel', description: 'Serviço de exemplo para o teste',
  category: 'unhas', active: true, price: 120, duration_minutes: 90,
  redeem_points: 300,
}, {
  id: '00000000-0000-4000-8000-000000000102',
  name: 'Alongamento', description: 'Outro exemplo do teste',
  category: 'unhas', active: true, price: 160, duration_minutes: 120,
  redeem_points: 400,
}];

function localServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403); res.end(); return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) file = path.join(root, 'index.html');
      const type = mime[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, {'content-type': type, 'cache-control': 'no-store'});
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end('Static server failed');
    }
  });
  return server;
}

function jwt(payload) {
  return [
    Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'test-signature',
  ].join('.');
}
function fakeSession(role) {
  const id = role === 'admin'
    ? '00000000-0000-4000-8000-000000000002'
    : '00000000-0000-4000-8000-000000000001';
  const issued = Math.floor(Date.now() / 1000);
  const user = {
    id, aud: 'authenticated', role: 'authenticated',
    email: role + '@browser-test.invalid',
    created_at: new Date().toISOString(),
    app_metadata: {provider: 'email', providers: ['email']},
    user_metadata: {full_name: role === 'admin' ? 'Admin Teste' : 'Cliente Teste'},
  };
  return {
    access_token: jwt({sub:id, role:'authenticated', aud:'authenticated', iat:issued, exp:issued + 86400}),
    refresh_token: 'browser-test-refresh',
    token_type: 'bearer',
    expires_in: 86400, expires_at: issued + 86400,
    user,
  };
}

async function mockSupabase(page, role) {
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const entity = url.pathname.split('/').pop();
    const accept = request.headers()['accept'] || '';
    let data = [];
    let code = 200;
    if (url.pathname.includes('/auth/v1/user')) {
      data = fakeSession(role || 'client').user;
    } else if (url.pathname.includes('/auth/v1/')) {
      data = {message:'Authentication unavailable in local smoke tests'};
      code = 400;
    } else if (url.pathname.includes('/rest/v1/rpc/')) {
      data = entity === 'get_my_loyalty'
        ? {balance:0,enabled:true,lifetime_points:0}
        : entity === 'available_slots' ? []
        : entity === 'p6_financial_dashboard' ? {
            metrics:{completed:1,revenue:120,ticket:120,clients:1,
              confirmed:0,confirmed_value:0,pending:0,cancelled:0},
            series:[],services:[],
          }
        : entity === 'p3_financial_snapshot' ? {
            metrics:{estimated_completed:120,registered_for_services:30,
              unrecorded:90,received_in_period:30,completed_count:1},
            appointments:[{id:'00000000-0000-4000-8000-000000008888',
              service:'Banho de Gel',client:'Cliente Fictícia',
              starts_at:'2026-11-12T16:00:00Z',price:120,registered:30,remaining:90}],
            receipts:[{id:'00000000-0000-4000-8000-000000009999',
              appointment_id:'00000000-0000-4000-8000-000000008888',
              client:'Cliente Fictícia',service:'Banho de Gel',amount:30,
              method:'pix',received_at:'2026-11-12T17:00:00Z'}],
            appointments_limit:60,receipts_limit:40,
          } : {};
    } else {
      switch (entity) {
        case 'services': data = testServices; break;
        case 'business_hours': data = [2,3,4,5,6].map(weekday => ({weekday,enabled:true})); break;
        case 'profiles':
          data = {
            id: (role === 'admin' ? fakeSession('admin') : fakeSession('client')).user.id,
            role: role === 'admin' ? 'admin' : 'client',
            phone: '11999999999',
            full_name: role === 'admin' ? 'Admin Teste' : 'Cliente Teste',
            avatar_path: null,
          };
          if (!accept.includes('vnd.pgrst.object')) data = [data];
          break;
        case 'account_deletion_requests':
          data = role === 'admin' ? [{
            id:'00000000-0000-4000-8000-000000007777',
            user_id:'00000000-0000-4000-8000-000000000001',
            created_at:'2026-11-11T12:00:00Z',
            status:'pending',response_note:null,handled_at:null,
          }] : [];
          break;
        case 'portfolio_photos':
        case 'notifications':
        case 'admin_notifications':
        case 'appointments':
        case 'points_ledger':
        case 'client_care_preferences':
        default: data = [];
      }
    }
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'content-range': '0-0/0',
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-range',
    };
    await route.fulfill({
      status: code,
      headers,
      body: request.method() === 'HEAD' ? '' : JSON.stringify(data),
    });
  });
}

async function testPage(browser, baseUrl, name, options, run) {
  const {testRole, ...contextOptions} = options;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', e => failures.push(e?.stack || String(e)));
  page.on('crash', () => failures.push('Chromium renderer crashed'));
  page.on('response', response => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400)
      failures.push('App asset HTTP ' + response.status() + ': ' + response.url());
  });

  if (options.testRole) {
    const session = fakeSession(options.testRole);
    await page.addInitScript(sessionJson => {
      window.localStorage.setItem('sb-example-auth-token', sessionJson);
    }, JSON.stringify(session));
  }
  await mockSupabase(page, options.testRole);
  const start = Date.now();

  try {
    const response = await page.goto(baseUrl, {waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response.status(), 200, name + ': initial HTML must be 200');
    await run(page);
    await page.waitForTimeout(350);
    assert.deepEqual(failures, [], name + ': no uncaught JavaScript errors or missing app assets');
    assert((await page.locator('body').innerText()).trim().length >= 80,
      name + ': the page cannot be blank');
    console.log('PASS ' + name + ' (' + (Date.now() - start) + 'ms)');
  } catch (error) {
    fs.mkdirSync(artifacts, {recursive: true});
    const screenshot = path.join(artifacts, name.replaceAll(/[^a-z0-9_-]/gi, '-') + '.png');
    await page.screenshot({path:screenshot,fullPage:true,timeout:5000}).catch(()=>{});
    const body = await page.locator('body').innerText({timeout:1500}).catch(()=>'(unavailable)');
    console.error('FAIL ' + name + ': ' + String(error));
    console.error('Body excerpt: ' + body.slice(0,1200));
    console.error('Browser exceptions: ' + failures.join('\n').slice(0,4500));
    console.error('Screenshot saved at ' + screenshot);
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  assert(fs.existsSync(path.join(root, 'index.html')), 'Run npm run build before browser tests');
  const server = localServer();
  await new Promise((resolve,reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = 'http://127.0.0.1:' + server.address().port + '/';
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    await testPage(browser,baseUrl,'guest-desktop', {viewport:{width:1280,height:900}}, async page => {
      await page.getByText('Conheça a TR Beauty Concept', {exact:true}).waitFor({state:'visible',timeout:25000});
      await page.getByText('Banho de Gel', {exact:true}).first().waitFor({state:'visible'});
      await page.getByText('Entrar ou criar conta',{exact:true}).last().click();
      await page.getByText('Bem-vinda ao seu espaço de beleza').waitFor({state:'visible'});
      await page.getByText('Continuar navegando sem conta').click();
      await page.getByText('Conheça a TR Beauty Concept',{exact:true}).waitFor({state:'visible'});
    });
    await testPage(browser,baseUrl,'guest-mobile',
      {viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
      async page => {
        await page.getByText('Conheça a TR Beauty Concept',{exact:true}).waitFor({state:'visible',timeout:25000});
        await page.getByText('Banho de Gel',{exact:true}).first().waitFor({state:'visible'});
        await page.getByText('Galeria',{exact:true}).last().click();
        await page.getByText('Início',{exact:true}).last().click();
        await page.getByText('Conheça a TR Beauty Concept',{exact:true}).waitFor({state:'visible'});
      });
    // Accessibility regression: small mobile viewports, touch targets and selected navigation.
    await testPage(browser,baseUrl,'mobile-a11y-320',
      {viewport:{width:320,height:640},deviceScaleFactor:2,isMobile:true,hasTouch:true,testRole:'client'},
      async page => {
        await page.getByText('Olá, Cliente!').waitFor({state:'visible',timeout:25000});
        for(const label of ['Início','Reservas','Galeria','Perfil']){
          const item=page.getByRole('button',{name:label,exact:true}).last();
          await item.waitFor({state:'visible'});
          const rect=await item.boundingBox();
          assert(rect&&rect.width>=44&&rect.height>=44,
            label+': mobile touch target must be at least 44x44 CSS pixels');
        }
        assert.equal(await page.getByRole('button',{name:'Início',exact:true}).last()
          .getAttribute('aria-current'),'page','Início must expose its current page state');
        const checkWidth=async label=>{
          const dims=await page.evaluate(()=>({
            scrollWidth:document.documentElement.scrollWidth,
            viewportWidth:document.documentElement.clientWidth,
          }));
          assert(dims.scrollWidth<=dims.viewportWidth+2,
            label+': horizontal document overflow '+JSON.stringify(dims));
        };
        await checkWidth('home 320px');
        await page.getByRole('button',{name:'Reservas',exact:true}).last().click();
        await page.getByText('Meus agendamentos',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Agendar novo horário'}).click();
        await page.getByRole('button',{name:'Selecionar Banho de Gel'}).click();
        await page.getByText('Horário',{exact:true}).waitFor({state:'visible'});
        for(const label of ['Mês anterior','Próximo mês','Voltar']){
          const rect=await page.getByRole('button',{name:label,exact:true}).first().boundingBox();
          assert(rect&&rect.width>=44&&rect.height>=44,
            label+': booking control must be at least 44x44 CSS pixels');
        }
        await checkWidth('booking 320px');
        const perf=await page.evaluate(()=>{
          const nav=performance.getEntriesByType('navigation')[0];
          return {domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),
            resourceCount:performance.getEntriesByType('resource').length};
        });
        console.log('MOBILE_DIAGNOSTIC 320px '+JSON.stringify(perf));
      });
    await testPage(browser,baseUrl,'client-session',
      {viewport:{width:390,height:844},isMobile:true,hasTouch:true,testRole:'client'},
      async page => {
        await page.getByText('Olá, Cliente!').waitFor({state:'visible',timeout:25000});
        await page.getByText('Reservas',{exact:true}).last().waitFor({state:'visible'});
        await page.getByRole('button',{name:'Abrir notificações'}).first().click();
        await page.getByText('Início',{exact:true}).last().click();
        await page.getByText('Olá, Cliente!').waitFor({state:'visible'});
      });
    // Critical client paths: points history, service selection and reservation hub.
    // Requests remain intercepted by fake Supabase; no production booking is made.
    await testPage(browser,baseUrl,'client-booking-points',
      {viewport:{width:390,height:844},isMobile:true,hasTouch:true,testRole:'client'},
      async page => {
        await page.getByText('Olá, Cliente!').waitFor({state:'visible',timeout:25000});
        await page.getByRole('button',{name:'Ver extrato completo do TR Points'}).click();
        await page.getByText('Meu TR Points',{exact:true}).waitFor({state:'visible'});
        await page.getByText('Pontos disponíveis para resgate',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Serviços',exact:true}).click();
        await page.getByText('Seu histórico de serviços aparecerá aqui após a conclusão dos atendimentos.')
          .waitFor({state:'visible'});
        await page.getByRole('button',{name:'Extrato',exact:true}).click();
        await page.getByText('Movimentações de pontos',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Usar TR Points para agendar um serviço'}).click();
        await page.getByRole('button',{name:'Selecionar Banho de Gel'}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Selecionar Banho de Gel'}).click();
        await page.getByText('Horário',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Voltar',exact:true}).click();
        await page.getByRole('button',{name:'Voltar',exact:true}).click();
        await page.getByText('Meus agendamentos',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Agendar novo horário'}).click();
        await page.getByRole('button',{name:'Selecionar Alongamento'}).click();
        await page.getByText('Horário',{exact:true}).waitFor({state:'visible'});
      });
    await testPage(browser,baseUrl,'admin-deletion-review',
      {viewport:{width:390,height:844},isMobile:true,hasTouch:true,testRole:'admin'},
      async page => {
        await page.getByText('Painel Admin 👩‍💻').waitFor({state:'visible',timeout:25000});
        await page.getByRole('button',{name:'Configurações da administração'}).click();
        await page.getByRole('button',{name:'Exclusão de contas'}).click();
        await page.getByText('Solicitações de privacidade',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Verificar vínculos do pedido de exclusão'}).click();
        await page.getByText('Verificação de vínculos da conta',{exact:true}).waitFor({state:'visible'});
        await page.getByText('Agendamentos ativos',{exact:true}).waitFor({state:'visible'});
        await page.getByText('Movimentações TR Points',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Reverificar vínculos da conta'}).click();
        await page.getByText('Registros financeiros',{exact:true}).waitFor({state:'visible'});
      });
    await testPage(browser,baseUrl,'admin-session',
      {viewport:{width:1280,height:900},testRole:'admin'},
      async page => {
        await page.getByText('Painel Admin 👩‍💻').waitFor({state:'visible',timeout:25000});
        await page.getByText('Indicadores Rápidos (Hoje)').waitFor({state:'visible'});
        await page.getByRole('button',{name:'Configurações da administração'}).click();
        await page.getByText('Configurações do estúdio').waitFor({state:'visible'});
        await page.getByRole('button',{name:'Métricas'}).click();
        await page.getByText('Controle de recebimentos',{exact:true}).waitFor({state:'visible'});
        await page.getByText('Sem registro de recebimento',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:/Registrar recebimento para Banho de Gel/}).click();
        await page.getByRole('textbox',{name:'Valor recebido em reais'}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Cancelar lançamento'}).click();
      });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
