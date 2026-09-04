import { apiHandler, method } from '@/lib/api';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['DELETE'])) return;
  res.setHeader(
    'Set-Cookie',
    `oidc_login_prompt=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`,
  );
  res.status(204).end();
});
