export function getFileName(
  quotationNumber: string | undefined,
  clientName: string | undefined,
) {
  if (!quotationNumber) {
    throw new Error("No se encontro el numero de cotizacion");
  } else if (!clientName) {
    throw new Error("No se encontro el numero de cliente");
  }
  return `Cotización N°${quotationNumber} - ${clientName.toUpperCase()} - Magic Medios SAS.pdf`;
}
