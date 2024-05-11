import { Map, rectangle, Rectangle } from 'leaflet';
import { getDistance, getGeoPoint, LatLng, move } from './mygeolib';

export interface PVArrayInfo {
    panelHorizontal: number;
    panelVertical: number;
    arraySeries: number;
    arrayParallel: number;
    arrayQuantity?: number;
}
const INITAL_ARRAY_INFO: PVArrayInfo = {
    panelHorizontal: 0,
    panelVertical: 0,
    arraySeries: 0,
    arrayParallel: 0,
    arrayQuantity: 0,
};

interface PVArraysData {
    pvArrays: Rectangle[];
    info: PVArrayInfo;
}
const INITIAL_ARRAY_DATA: PVArraysData = {
    pvArrays: [],
    info: INITAL_ARRAY_INFO,
};

/******************************************************************/
// 名称: PVLayoutクラス
//
// 機能: PVパネルを配置するレイアウトやアレイの描画・消去を管理するクラス。
//       地図描画にはLeafletを使用。
//       レイアウトの面積やパネル数を取得するメソッドをもつ。
/******************************************************************/
export class PVLayout {
    static rectangleHorizontal(r: Rectangle) {
        const southWest = r.getBounds().getSouthWest();
        const northEast = r.getBounds().getNorthEast();
        return getDistance({ lat: southWest.lat, lng: southWest.lng }, { lat: southWest.lat, lng: northEast.lng });
    }

    static rectangleVertical(r: Rectangle) {
        const southWest = r.getBounds().getSouthWest();
        const northEast = r.getBounds().getNorthEast();
        return getDistance({ lat: southWest.lat, lng: southWest.lng }, { lat: northEast.lat, lng: southWest.lng });
    }

    static isValidInfo(info: PVArrayInfo): boolean {
        if (info.panelHorizontal > 0 && info.panelVertical > 0 && info.arraySeries > 0 && info.arrayParallel > 0) {
            return true;
        }
        return false;
    }

    protected readonly layout: Rectangle;
    protected readonly layoutHorizontal: number;
    protected readonly layoutVertical: number;
    protected readonly innerHorizontal: number;
    protected readonly innerVertical: number;
    protected arraysData: PVArraysData = { ...INITIAL_ARRAY_DATA };

    constructor(
        protected readonly map: Map,
        protected readonly startLatLng: LatLng,
        protected readonly endLatLng: LatLng,
        protected readonly interval_x: number = 0.1,
        protected readonly interval_y: number = 2,
        protected readonly padding: number = 1
    ) {
        this.layout = rectangle([getGeoPoint(startLatLng), getGeoPoint(endLatLng)], {
            weight: 1,
        }).addTo(map);
        this.layoutVertical = PVLayout.rectangleVertical(this.layout);
        this.layoutHorizontal = PVLayout.rectangleHorizontal(this.layout);
        this.innerVertical = this.layoutVertical - this.padding * 2;
        this.innerHorizontal = this.layoutHorizontal - this.padding * 2;
    }

    /******************************************************************/
    // 名称: setArraysメソッド
    //
    // 機能: 配置するアレイのレイアウトを生成＆座標計算してMapに描画する。
    //       またアレイやパネルの情報を保持する。
    //
    // 引数: pvArrayInfo = { パネル横幅, 〃縦幅, 直列数, 並列数 }
    //
    // 戻り値: 無し
    /******************************************************************/
    setArrays(pvArrayInfo: PVArrayInfo) {
        // アレイ情報に無効な値が含まれていればアレイ描画を消して終了
        if (!PVLayout.isValidInfo(pvArrayInfo)) {
            this.removeArrays();
            return;
        }
        // アレイ情報がインスタンス変数に保持しているものと同じなら何もせず終了
        if (this.equalPVArrayInfo(pvArrayInfo)) {
            return;
        }

        this.removeArrays();

        const arrayHorizontal = pvArrayInfo.panelHorizontal * pvArrayInfo.arraySeries;
        const arrayVertical = pvArrayInfo.panelVertical * pvArrayInfo.arrayParallel;

        // 縦横のアレイ数
        const yoko = Math.floor((this.innerHorizontal - arrayHorizontal) / (arrayHorizontal + this.interval_x)) + 1;
        const tate = Math.floor((this.innerVertical - arrayVertical) / (arrayVertical + this.interval_y)) + 1;

        // アレイ配置開始の座標（最南西）
        const firstPoint = move(this.layout.getBounds().getSouthWest(), Math.SQRT2 * this.padding, 45);

        const pvArrays: Rectangle[] = [];
        // アレイの座標を計算（下から上へ）
        for (let y = 0; y < tate; y++) {
            const offsetY = (arrayVertical + this.interval_y) * y;
            const rowFirstPoint = move(firstPoint, offsetY, 0);
            // アレイの座標を計算（左から右へ）
            for (let x = 0; x < yoko; x++) {
                const offsetX = (arrayHorizontal + this.interval_x) * x;
                const southWest = move(rowFirstPoint, offsetX, 90);
                const southEast = move(southWest, arrayHorizontal, 90); // 一気にnorthEastを求められればこの行は不要になる
                const northEast = move(southEast, arrayVertical, 0);
                const arrayLayout = rectangle([getGeoPoint(southWest), getGeoPoint(northEast)], {
                    color: '#0000FF',
                    weight: 1,
                });
                arrayLayout.addTo(this.map);
                pvArrays.push(arrayLayout);
            }
        }

        // アレイやパネルの情報をインスタンス変数で保持
        this.arraysData = {
            pvArrays: pvArrays,
            info: {
                ...pvArrayInfo,
                arrayQuantity: yoko * tate,
            },
        };
    }

    /******************************************************************/
    // 名称: equalPVArrayInfoメソッド
    //
    // 機能: インスタンス変数で保持しているアレイ情報と引数を比較する。
    //       ただしアレイ数は比較しない。
    //
    // 引数: pvArrayInfo = { パネル横幅, 〃縦幅, 直列数, 並列数 }
    //
    // 戻り値: 一致する場合はtrueを返す。
    /******************************************************************/
    equalPVArrayInfo(info: PVArrayInfo): boolean {
        if (
            info.panelHorizontal == this.arraysData.info.panelHorizontal &&
            info.panelVertical == this.arraysData.info.panelVertical &&
            info.arraySeries == this.arraysData.info.arraySeries &&
            info.arrayParallel == this.arraysData.info.arrayParallel
        ) {
            return true;
        } else {
            return false;
        }
    }

    remove() {
        this.removeArrays();
        this.layout.remove();
    }

    removeArrays() {
        this.arraysData.pvArrays.forEach((pvArray) => {
            pvArray.remove();
        });
        this.arraysData = { ...INITIAL_ARRAY_DATA };
    }

    getLayoutArea(): number {
        return this.layoutHorizontal * this.layoutVertical;
    }

    getPanelQuantity(): number {
        if (this.arraysData.info.arrayQuantity === undefined) {
            return 0;
        }
        return (
            this.arraysData.info.arraySeries * this.arraysData.info.arrayParallel * this.arraysData.info.arrayQuantity
        );
    }

    toString(): string {
        return `レイアウト = 横: ${this.layoutHorizontal}m × 縦: ${
            this.layoutVertical
        }m , PVパネル数 = ${this.getPanelQuantity()}`;
    }
}
