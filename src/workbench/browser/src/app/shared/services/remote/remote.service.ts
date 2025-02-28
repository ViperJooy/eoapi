import { Injectable } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  DataSourceType,
  DATA_SOURCE_TYPE_KEY,
  StorageService,
} from 'eo/workbench/browser/src/app/shared/services/storage/storage.service';
import { MessageService } from 'eo/workbench/browser/src/app/shared/services/message/message.service';
import { Message } from 'eo/workbench/browser/src/app/shared/services/message/message.model';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Router } from '@angular/router';
import { ApiData } from 'eo/workbench/browser/src/app/shared/services/storage/index.model';
import { ElectronService } from 'eo/workbench/browser/src/app/core/services/electron/electron.service';

/** is show switch success tips */
export const IS_SHOW_DATA_SOURCE_TIP = 'IS_SHOW_DATA_SOURCE_TIP';

/**
 * @description
 * A message queue global send and get message
 */
@Injectable({
  providedIn: 'root',
})
export class RemoteService {
  private destroy$: Subject<void> = new Subject<void>();
  /** data source type @type { DataSourceType }  */
  dataSourceType: DataSourceType = (localStorage.getItem(DATA_SOURCE_TYPE_KEY) as DataSourceType) || 'local';
  get isElectron() {
    return this.electronService.isElectron;
  }
  /** Is it a remote data source */
  get isRemote() {
    return this.dataSourceType === 'http';
  }
  /** Text corresponding to the current data source */
  get dataSourceText() {
    return this.isRemote ? '远程' : '本地';
  }
  /** get mock url */
  get mockUrl() {
    return this.isRemote
      ? window.eo?.getModuleSettings?.('eoapi-common.remoteServer.url') + '/mock/eo-1/'
      : window.eo?.getMockUrl?.();
  }

  constructor(
    private storageService: StorageService,
    private messageService: MessageService,
    private message: NzMessageService,
    public electronService: ElectronService,
    private router: Router
  ) {
    this.messageService
      .get()
      .pipe(takeUntil(this.destroy$))
      .subscribe((inArg: Message) => {
        switch (inArg.type) {
          case 'onDataSourceChange': {
            this.dataSourceType = inArg.data.dataSourceType;
            if (localStorage.getItem(IS_SHOW_DATA_SOURCE_TIP) === 'true') {
              this.showMessage();
            }
            break;
          }
        }
      });
  }

  getApiUrl(apiData: ApiData) {
    const url = new URL(`${this.mockUrl}/${apiData.uri}`.replace(/(?<!:)\/{2,}/g, '/'), 'https://github.com/');
    if (apiData) {
      url.searchParams.set('mockID', apiData.uuid + '');
    }
    console.log('getApiUrl', decodeURIComponent(url.toString()));
    return decodeURIComponent(url.toString());
  }

  async refreshComponent() {
    const { pathname, searchParams } = new URL(this.router.url, 'https://github.com/');
    // console.log('this.router', pathname, Object.fromEntries(searchParams.entries()));
    await this.router.navigate(['**']);
    await this.router.navigate([pathname], { queryParams: Object.fromEntries(searchParams.entries()) });
  }

  /**
   * 测试远程服务器地址是否可用
   */
  async pingRmoteServerUrl(): Promise<[boolean, any]> {
    const { url: remoteUrl, token } = window.eo?.getModuleSettings('eoapi-common.remoteServer') || {};

    if (!remoteUrl) {
      return [false, remoteUrl];
    }

    const url = `${remoteUrl}/system/status`.replace(/(?<!:)\/{2,}/g, '/');

    let result;
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': token,
        },
      });
      result = await response.json();

      if (result.statusCode !== 200) {
        return [false, result];
      }
    } catch (e) {
      return [false, e];
    }
    return [true, result];
  }

  switchToLocal() {
    this.storageService.toggleDataSource({ dataSourceType: 'local' });
  }

  switchToHttp() {
    this.storageService.toggleDataSource({ dataSourceType: 'http' });
  }

  /**
   * switch data
   */
  switchDataSource = async () => {
    if (this.isRemote) {
      localStorage.setItem(IS_SHOW_DATA_SOURCE_TIP, 'true');
      this.switchToLocal();
      this.refreshComponent();
    } else {
      const [isSuccess] = await this.pingRmoteServerUrl();
      if (isSuccess) {
        localStorage.setItem(IS_SHOW_DATA_SOURCE_TIP, 'true');
        this.switchToHttp();
        this.refreshComponent();
      } else {
        console.log('切换失败');
        this.message.create('error', `远程数据源不可用`);
        localStorage.setItem(IS_SHOW_DATA_SOURCE_TIP, 'false');
      }
    }
  };

  showMessage() {
    this.message.create('success', `成功切换到${this.dataSourceText}数据源`);
    localStorage.setItem('IS_SHOW_DATA_SOURCE_TIP', 'false');
  }
}
