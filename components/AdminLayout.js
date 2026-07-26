import StudioLayout from './StudioLayout';

export default function AdminLayout({
  accessDeniedRedirect = '/studio',
  ...props
}) {
  return (
    <StudioLayout
      {...props}
      accessDeniedRedirect={accessDeniedRedirect}
      wide
    />
  );
}
