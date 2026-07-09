export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/admin/inventory',
      permanent: true,
    },
  };
}

export default function AdminStockRedirect() {
  return null;
}
