const express = require('express');
const cors = require('cors');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// 모든 도메인(GitHub Pages 포함)에서의 호출 허용
app.use(cors());

// 상태 확인용 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.send('Proxy Server is Running!');
});

// /proxy?url=... 엔드포인트
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Target URL이 필요합니다. 예: /proxy?url=https://band.us');
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (err) {
    return res.status(400).send('올바른 URL 형식이 아닙니다.');
  }

  const proxy = createProxyMiddleware({
    target: parsedTarget.origin,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: () => parsedTarget.pathname + parsedTarget.search,
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        // iframe 차단 보안 헤더 제거
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
        delete proxyRes.headers['content-security-policy-report-only'];

        // 정적 리소스(CSS, JS, 이미지) 경로 보정용 <base> 태그 삽입
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          let html = responseBuffer.toString('utf8');
          const baseTag = `<base href="${parsedTarget.origin}/">`;
          html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
          return html;
        }

        return responseBuffer;
      }),
    },
  });

  return proxy(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});