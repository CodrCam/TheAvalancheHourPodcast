export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/admin/products?view=stock',
      permanent: true,
    },
  };
}

export default function AdminStockRedirect() {
  return null;
}
