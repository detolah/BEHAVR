const prisma = require('../lib/prisma');

async function seedProfile(customer_id, company_id) {
  return prisma.profile.upsert({
    where: { customer_id_company_id: { customer_id, company_id } },
    create: { customer_id, company_id, core_fields: null, industry_fields: null },
    update: {},
  });
}

async function getProfile(customer_id, company_id) {
  return prisma.profile.findUnique({
    where: { customer_id_company_id: { customer_id, company_id } },
    include: {
      customer: { select: { id: true, email: true, name: true } },
    },
  });
}

async function updateProfile(profile_id, company_id, fields, changed_by) {
  const existing = await prisma.profile.findFirst({ where: { id: profile_id, company_id } });
  if (!existing) return null;

  const historyEntries = [];
  const updateData = { last_updated_by: changed_by };

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'core_fields' || key === 'industry_fields') {
      const oldGroup = existing[key] || {};
      for (const [subKey, subVal] of Object.entries(value)) {
        if (JSON.stringify(oldGroup[subKey]) !== JSON.stringify(subVal)) {
          historyEntries.push({
            profile_id,
            changed_by,
            field_name: `${key}.${subKey}`,
            old_value: oldGroup[subKey] != null ? String(oldGroup[subKey]) : null,
            new_value: subVal != null ? String(subVal) : null,
          });
        }
      }
      updateData[key] = { ...oldGroup, ...value };
    } else if (['agent_note', 'new_agent_brief'].includes(key)) {
      if (existing[key] !== value) {
        historyEntries.push({ profile_id, changed_by, field_name: key, old_value: existing[key], new_value: value });
      }
      updateData[key] = value;
    }
  }

  const [profile] = await prisma.$transaction([
    prisma.profile.update({ where: { id: profile_id }, data: updateData }),
    ...(historyEntries.length > 0 ? [prisma.profileHistory.createMany({ data: historyEntries })] : []),
  ]);

  return profile;
}

async function getProfileHistory(profile_id, company_id) {
  const profile = await prisma.profile.findFirst({ where: { id: profile_id, company_id } });
  if (!profile) return null;
  return prisma.profileHistory.findMany({
    where: { profile_id },
    orderBy: { changed_at: 'desc' },
  });
}

module.exports = { seedProfile, getProfile, updateProfile, getProfileHistory };
