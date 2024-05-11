const R = Math.PI / 180;
const EARTH_RADIUS = 6378150;

export interface LatLng {
  lat: number;
  lng: number;
}
export type GeoPoint = [number, number];

export const getGeoPoint = (latlng: LatLng): GeoPoint => {
  return [latlng.lat, latlng.lng];
}


/******************************************************************/
// 名称: getDistance関数
//
// 機能: 座標1と2の間の距離を求める
//
// 引数: latlng1 = 座標1
//       latlng2 = 座標2
//
// 戻り値: 距離(m)
/******************************************************************/
export const getDistance = (latlng1: LatLng, latlng2: LatLng) => {
  const lat1 = latlng1.lat * R;
  const lng1 = latlng1.lng * R;
  const lat2 = latlng2.lat * R;
  const lng2 = latlng2.lng * R;
  return EARTH_RADIUS * Math.acos(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1) + Math.sin(lat1) * Math.sin(lat2));
};


/******************************************************************/
// 名称: move関数
//
// 機能: 現在地・距離・角度を指定して新たな座標を求める。
//
// 引数: latlng = 現在の座標
//       distance = 距離(m)
//       heading = 角度（0:↑ 90:→ 180:↓ -90:←）
//
// 戻り値: 移動後の座標
/******************************************************************/
export const move = (latlng: LatLng, distance: number, heading: number): LatLng => {
  // 緯線上の移動距離
  const lat_distance = distance * Math.cos(heading * Math.PI / 180);

  // 1mあたりの緯度
  const earth_circle = 2 * Math.PI * EARTH_RADIUS;
  const lat_per_meter = 360 / earth_circle;

  // 緯度の変化量
  const lat_delta = lat_distance * lat_per_meter;
  const new_lat = latlng.lat + lat_delta;

  // 経線上の移動距離
  const lng_distance = distance * Math.sin(heading * Math.PI / 180);

  // 1mあたりの経度
  const earth_radius_at_lng = EARTH_RADIUS * Math.cos(new_lat * Math.PI / 180);
  const earth_circle_at_lng = 2 * Math.PI * earth_radius_at_lng;
  const lng_per_meter = 360 / earth_circle_at_lng;

  // 経度の変化量
  const lng_delta = lng_distance * lng_per_meter;

  return { lat: new_lat, lng: latlng.lng + lng_delta };
}
