import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PVArrayInfo, PVLayout } from './modules/pvlayout';
import { PVAREAS } from './data/pvareas';
import { PVPOINTS } from './data/pvpoints';
import { pvCalculate } from './modules/pvcalculate';

// 定数
const ACTIVECLASS = 'active';
const FIRST: L.LatLngExpression = [33.8083333333333, 130.538333333333];

// 地図
const map = L.map('mapid', {
    center: FIRST,
    zoom: 10,
});
const myTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
        '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
});
myTileLayer.addTo(map);

// その他変数
const startMarker = L.marker(FIRST);
let startPoint: L.LatLng | null = null;
const pvLayouts: PVLayout[] = [];
let totalArea = 0;
let isCreating = false;
let selectedPVAreaId = 0;
let selectedPVPointId = 0;

/******************************************************************/
// 名称: toTextValue関数
//
// 機能: 数値を3桁区切りかつ小数点第2位までの文字列にする
//
// 引数: value = 数値
//
// 戻り値: 3桁区切りした小数点第2位までの文字列
/******************************************************************/
const toTextValue = (value: number) => {
    const numbers = (Math.floor(value * 100) / 100).toString().split('.');
    numbers[0] = Number(numbers[0])
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return numbers.join('.');
};

/******************************************************************/
// 名称: getPVArrayInfo関数
//
// 機能: DOMでInputから値を取得して、PVArrayInfoで返す。
//
// 引数: 無し
//
// 戻り値: pvArrayInfo = { パネル横幅, 〃縦幅, 直列数, 並列数 }
/******************************************************************/
const getPVArrayInfo = (): PVArrayInfo => {
    const panelHorizontal = (document.getElementById('panel-horizontal') as HTMLInputElement).value;
    const panelVertical = (document.getElementById('panel-vertical') as HTMLInputElement).value;
    const arraySeries = (document.getElementById('array-series') as HTMLInputElement).value;
    const arrayParallel = (document.getElementById('array-parallel') as HTMLInputElement).value;
    return {
        panelHorizontal: Number(panelHorizontal),
        panelVertical: Number(panelVertical),
        arraySeries: Number(arraySeries),
        arrayParallel: Number(arrayParallel),
    };
};

/******************************************************************/
// 名称: getTotalPanelQuantity関数
//
// 機能: PVレイアウト配列の要素からパネル数を取得して合計値を返す。
//
// 引数: 無し
//
// 戻り値: 総パネル数
/******************************************************************/
const getTotalPanelQuantity = (): number => {
    let total = 0;
    pvLayouts.forEach((pvLayout) => {
        total += pvLayout.getPanelQuantity();
    });
    return total;
};

/******************************************************************/
// 名称: handleCreateLayout関数
//
// 機能: レイアウト作成ボタンのクリックイベント。
//       ボタン活性・非活性や、作成中状態を切り替える。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const handleCreateLayout = () => {
    if (!isCreating) {
        if (pvLayouts.length > 2) {
            alert('Demo版につき4エリア以上は非対応です。');
        } else {
            // 通常 ⇒ 作成中
            const buttonCreateLayout = document.getElementById('button-create-layout');
            if (buttonCreateLayout) {
                buttonCreateLayout.classList.add(ACTIVECLASS);
            }
            const buttonDeleteLayout = document.getElementById('button-delete-layout') as HTMLButtonElement | null;
            if (buttonDeleteLayout) {
                buttonDeleteLayout.disabled = true;
            }
            isCreating = true;
        }
    } else {
        // 作成中 ⇒ 通常
        const buttonCreateLayout = document.getElementById('button-create-layout');
        if (buttonCreateLayout) {
            buttonCreateLayout.classList.remove(ACTIVECLASS);
        }

        const buttonDeleteLayout = document.getElementById('button-delete-layout') as HTMLButtonElement | null;
        if (buttonDeleteLayout) {
            buttonDeleteLayout.disabled = false;
        }

        startMarker.remove();
        isCreating = false;
        startPoint = null;
    }
    handleRecalculation(); // 再計算実行
};

/******************************************************************/
// 名称: handleDeleteLayout関数
//
// 機能: レイアウト削除ボタンのクリックイベント。
//       地図からレイアウトを削除したり、総面積等の値を初期化する。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const handleDeleteLayout = () => {
    pvLayouts.forEach((pvLayout) => {
        pvLayout.remove();
    });
    pvLayouts.splice(0);
    totalArea = 0;
    (document.getElementById('total-area') as HTMLInputElement).value = '0';
    (document.getElementById('total-panel-quantity') as HTMLInputElement).value = '0';
    handleRecalculation(); // 再計算実行
};

/******************************************************************/
// 名称: handleClickMap関数
//
// 機能: 地図のクリックイベント。
//       レイアウト作成中に地図をクリックすると、
//       2点の座標から四角形を作り地図に描画する。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const handleClickMap = (event: L.LeafletMouseEvent) => {
    if (isCreating) {
        if (!startPoint) {
            if (pvLayouts.length > 2) {
                alert('Demo版につき4エリア以上は非対応です。');
            } else {
                // 開始座標を保持してマーカーをつける
                startPoint = event.latlng;
                startMarker.setLatLng(startPoint).addTo(map);
            }
        } else {
            // 開始座標とクリックした座標を用いてPVレイアウトを生成
            const pvLayout = new PVLayout(map, startPoint, event.latlng);
            pvLayouts.push(pvLayout);

            // 総面積
            totalArea += pvLayout.getLayoutArea();
            (document.getElementById('total-area') as HTMLInputElement).value = toTextValue(totalArea);

            // 開始座標初期化
            startMarker.remove();
            startPoint = null;
        }
    }
};

/******************************************************************/
// 名称: isPVAreaAndPointChange関数
//
// 機能: レイアウト作成後のエリア変更で警告メッセージを表示する。
//       OK⇒レイアウト削除
//       キャンセル⇒セレクトボックスの値を元に戻す
//
// 引数: 無し
//
// 戻り値: 真偽値 = エリアを変更するか否か
/******************************************************************/
const isPVAreaAndPointChange = (): boolean => {
    if (pvLayouts.length > 0) {
        const result = window.confirm('エリアを変えると、すでに作成されたレイアウトは削除されます。\nよろしいですか？');
        if (result) {
            handleDeleteLayout();
        } else {
            // 元の値に戻す
            (document.getElementById('pv-area-select') as HTMLSelectElement).value = selectedPVAreaId.toString();
            (document.getElementById('pv-point-select') as HTMLSelectElement).value = selectedPVPointId.toString();
            return false;
        }
    }
    return true;
};

/******************************************************************/
// 名称: hancleChangePVAreaSelect関数
//
// 機能: 都道府県（PVエリア）セレクトボックスの値変更イベント。
//       エリア（PVポイント）セレクトボックスのオプションを変更する。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const hancleChangePVAreaSelect = () => {
    if (!isPVAreaAndPointChange()) {
        return;
    }
    selectedPVAreaId = parseInt((document.getElementById('pv-area-select') as HTMLSelectElement).value);

    // エリア（PVポイント）セレクトボックスのオプション削除・追加
    const pvPointSelect = document.getElementById('pv-point-select') as HTMLSelectElement;
    while (pvPointSelect.lastChild) {
        pvPointSelect.removeChild(pvPointSelect.lastChild);
    }
    PVPOINTS.filter((pvPoint) => pvPoint.areaId === selectedPVAreaId).forEach((pvPoint) => {
        const option = document.createElement('option') as HTMLOptionElement;
        option.text = pvPoint.pointName;
        option.value = pvPoint.pointId.toString();
        pvPointSelect.appendChild(option);
    });
    handleChangePVPointSelect();
};

/******************************************************************/
// 名称: handleChangePVPointSelect関数
//
// 機能: エリア（PVポイント）セレクトボックスの値変更イベント。
//       年間日射量の計算、及び地図の座標を変更。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const handleChangePVPointSelect = () => {
    if (!isPVAreaAndPointChange()) {
        return;
    }
    selectedPVPointId = parseInt((document.getElementById('pv-point-select') as HTMLSelectElement).value);

    const pvPoint = PVPOINTS.find((pvPoint) => pvPoint.pointId === selectedPVPointId);
    if (pvPoint) {
        (document.getElementById('kwh-m2-year') as HTMLInputElement).value = toTextValue(pvPoint.kWhM2DayAvg * 365);
        map.setView([pvPoint.lat, pvPoint.lng], 10);
    }
};

/******************************************************************/
// 名称: handleRecalculation関数
//
// 機能: 各種パラメーターの値変更イベント。
//       アレイ配置数・総パネル数・総発電容量・年間発電量を計算して表示する。
//
// 引数: 無し
//
// 戻り値: 無し
/******************************************************************/
const handleRecalculation = () => {
    console.log('アレイ再配置');
    pvLayouts.forEach((pvLayout) => {
        pvLayout.setArrays(getPVArrayInfo());
        console.log(pvLayout.toString());
    });

    // 総パネル数
    const totalPanelQuantity = getTotalPanelQuantity();
    (document.getElementById('total-panel-quantity') as HTMLInputElement).value = toTextValue(totalPanelQuantity);

    // 総発電容量
    const panelCapacity = Number((document.getElementById('panel-capacity') as HTMLInputElement).value);
    const totalPanelCapacity = totalPanelQuantity * panelCapacity;
    (document.getElementById('total-panel-capacity') as HTMLInputElement).value = toTextValue(totalPanelCapacity);

    // 年間発電量
    setElectricGeneratingCapacity(totalPanelCapacity);
};

/******************************************************************/
// 名称: setElectricGeneratingCapacity関数
//
// 機能: 年間発電量を計算してテキストフィールドに表示する。
//
// 引数: pas = 太陽光発電システムの発電容量(パネル容量 * 枚数)
//
// 戻り値: 無し
/******************************************************************/
const setElectricGeneratingCapacity = (pas: number) => {
    let ep = 0;
    if (pas > 0) {
        // ha  = 日射量(kWh/㎡・year)
        const selectedPVPoint = PVPOINTS.find((pvPoint) => pvPoint.pointId === selectedPVPointId);
        if (selectedPVPoint) {
            const ha = selectedPVPoint.kWhM2DayAvg * 365;
            ep = pvCalculate(pas, ha);
        }
    }
    const capacity = document.getElementById('electric-generating-capacity') as HTMLInputElement | null;
    if (capacity) {
        capacity.value = toTextValue(ep);
    }
};

/******************************************************************/
// クリックや値変更のイベントを設定する。
/******************************************************************/
// 地図
map.on('click', handleClickMap);

// レイアウト作成・削除ボタン
const buttonCreateLayout = document.getElementById('button-create-layout') as HTMLButtonElement | null;
if (buttonCreateLayout) {
    buttonCreateLayout.onclick = handleCreateLayout;
}
const buttonDeleteLayout = document.getElementById('button-delete-layout') as HTMLButtonElement | null;
if (buttonDeleteLayout) {
    buttonDeleteLayout.onclick = handleDeleteLayout;
}

// PVパネル・アレイ情報
const panelHorizontal = document.getElementById('panel-horizontal') as HTMLInputElement | null;
if (panelHorizontal) {
    panelHorizontal.onchange = handleRecalculation;
}
const panelVertical = document.getElementById('panel-vertical') as HTMLInputElement | null;
if (panelVertical) {
    panelVertical.onchange = handleRecalculation;
}
const arraySeries = document.getElementById('array-series') as HTMLInputElement | null;
if (arraySeries) {
    arraySeries.onchange = handleRecalculation;
}
const arrayParallel = document.getElementById('array-parallel') as HTMLInputElement | null;
if (arrayParallel) {
    arrayParallel.onchange = handleRecalculation;
}
const panelCapacity = document.getElementById('panel-capacity') as HTMLInputElement | null;
if (panelCapacity) {
    panelCapacity.onchange = handleRecalculation;
}

// 都道府県セレクトボックス
const select = document.getElementById('pv-area-select') as HTMLSelectElement;
PVAREAS.forEach((pvarea) => {
    const option = document.createElement('option') as HTMLOptionElement;
    option.text = pvarea.areaName;
    option.value = pvarea.areaId.toString();
    select.appendChild(option);
});
select.onchange = hancleChangePVAreaSelect;

// エリアセレクトボックス
(document.getElementById('pv-point-select') as HTMLSelectElement).onchange = handleChangePVPointSelect;

// 都道府県セレクトボックス初期値設定・変更イベント実行
select.value = '82';
hancleChangePVAreaSelect();
