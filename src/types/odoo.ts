export type OdooProductListItem = {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
  image_128: string | false;
  image_512: string | false;
  categ_id: [number, string] | false;
};

export type OdooCategory = {
  id: number;
  name: string;
  parent_id: [number, string] | false;
};
