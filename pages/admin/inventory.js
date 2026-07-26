export default function LegacyInventoryPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/admin/products?view=stock',
      permanent: false,
    },
  };
}
