const prisma = require('../lib/prisma');

async function attachCompany(req, res, next) {
  if (req.company) return next();
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
    });
    if (!company) return res.status(403).json({ error: 'Company not found' });
    req.company = company;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachCompany };
