const { GET } = require('./src/app/api/dashboard/drilldown/route.ts');
const { signToken } = require('./src/lib/auth.ts');

async function test() {
  const token = signToken({
    userId: 'some-user-id',
    email: 'test@example.com',
    role: 'ADMIN',
    companyId: 'c9f4208a-dc75-4882-b87d-7100d4fbdd06'
  });

  const mockRequest = {
    url: 'http://localhost:3000/api/dashboard/drilldown?type=salaries_paid&periods=2026-07&partnerId=7cd7f425-bf37-4fcb-856c-00cf2a0bab17',
    headers: {
      get: (name) => {
        if (name === 'cookie') {
          return `session=${token}`;
        }
        return null;
      }
    }
  };

  console.log('Testing GET handler directly with mock request...');
  try {
    const response = await GET(mockRequest);
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during GET execution:', error);
  }
}

test();
