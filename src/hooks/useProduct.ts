import { useEffect, useState } from 'react';
import { PRODUCT, type Product } from '../config/site';
import { api } from '../services/api';

/** قیمت و اطلاعات محصول از لایه‌ی سرویس خوانده می‌شه؛ تا رسیدن جواب، مقدار config نمایش داده می‌شه. */
export function useProduct(): Product {
  const [product, setProduct] = useState<Product>(PRODUCT);
  useEffect(() => {
    let alive = true;
    api.getProduct().then((p) => alive && setProduct(p)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return product;
}
