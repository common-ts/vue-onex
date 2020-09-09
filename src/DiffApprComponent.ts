import {clone, diff} from 'reflectx';
import {Vue} from 'vue-property-decorator';
import {messageByHttpStatus} from './core';
import {Locale} from './core';
import {ResourceService} from './core';
import {LoadingService} from './core';

export interface DiffModel<T, ID> {
  id?: ID;
  origin?: T;
  value: T;
}
export interface DiffService<T, ID> {
  keys(): string[];
  diff(id: ID, ctx?: any): Promise<DiffModel<T, ID>>;
}
enum Status {
  NotFound = 0,
  Success = 1,
  VersionError = 2,
  Error = 4
}
export interface ApprService<ID> {
  approve(id: ID, ctx?: any): Promise<Status>;
  reject(id: ID, ctx?: any): Promise<Status>;
}
export interface DiffApprService<T, ID> extends DiffService<T, ID>, ApprService<ID> {
}

export class DiffApprComponent<T, ID> extends Vue {
  protected loading?: LoadingService;
  protected getLocale: () => Locale;
  protected showMessage: (msg: string) => void;
  protected showError: (m: string, title?: string, detail?: string, callback?: () => void) => void;
  protected resourceService?: ResourceService;
  protected service: DiffApprService<T, ID>;

  resource: any;
  protected running: boolean;
  protected form: any;
  protected id: ID = null;
  origin = {};
  value = {};
  disabled = false;

  onCreated(service: DiffApprService<T, ID>,
      resourceService: ResourceService,
      getLocale: () => Locale,
      showMessage: (msg: string) => void,
      showError: (m: string, title?: string, detail?: string, callback?: () => void) => void,
      loading?: LoadingService) {
    this.getLocale = getLocale;
    this.showMessage = showMessage;
    this.showError = showError;

    this.loading = loading;
    this.resourceService = resourceService;
    this.service = service;

    this.resource = resourceService.resource();
    this.back = this.back.bind(this);

    this.load = this.load.bind(this);
    this.handleNotFound = this.handleNotFound.bind(this);
    this.format = this.format.bind(this);
    this.formatFields = this.formatFields.bind(this);
    this.approve = this.approve.bind(this);
    this.reject = this.reject.bind(this);
    this.handleError = this.handleError.bind(this);
    this.alertError = this.alertError.bind(this);
  }

  protected back(): void {
    window.history.back();
  }

  async load(_id: ID) {
    const x: any = _id;
    if (x && x !== '') {
      this.id = _id;
      try {
        this.running = true;
        if (this.loading) {
          this.loading.showLoading();
        }
        const dobj = await this.service.diff(_id);
        if (!dobj) {
          this.handleNotFound(this.form);
        } else {
          const formatdDiff = formatDiffModel(dobj, this.formatFields);
          this.format(formatdDiff.origin, formatdDiff.value);
          this.value = formatdDiff.value;
          this.origin = formatdDiff.origin;
        }
      } catch (err) {
        const data = (err &&  err.response) ? err.response : err;
        if (data && data.status === 404) {
          this.handleNotFound(this.form);
        } else {
          this.handleError(err);
        }
      } finally {
        this.running = false;
        if (this.loading) {
          this.loading.hideLoading();
        }
      }
    }
  }

  protected handleNotFound(form?: any) {
    this.disabled = true;
    this.alertError(this.resourceService.value('error_not_found'));
  }

  format(origin: T, value: T): void {
    const differentKeys = diff(origin, value);
    const form = this.form;
    for (const differentKey of differentKeys) {
      const y = form.querySelector('.' + differentKey);
      if (y) {
        if (y.childNodes.length === 3) {
          y.children[1].classList.add('highlight');
          y.children[2].classList.add('highlight');
        } else {
          y.classList.add('highlight');
        }
      }
    }
  }

  formatFields(value: T): T {
    return value;
  }

  async approve(event: any) {
    event.preventDefault();
    if (this.running) {
      return;
    }
    try {
      this.running = true;
      if (this.loading) {
        this.loading.showLoading();
      }
      const status = await this.service.approve(this.id);
      const r = this.resourceService;
      if (status === Status.Success) {
        this.showMessage(r.value('msg_approve_success'));
      } else if (status === Status.VersionError) {
        this.alertError(r.value('msg_approve_version_error'));
      } else if (status === Status.NotFound) {
        this.handleNotFound(this.form);
      } else {
        this.alertError(r.value('msg_approve_version_error'));
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.disabled = true;
      this.running = false;
      if (this.loading) {
        this.loading.hideLoading();
      }
    }
  }

  async reject(event: any) {
    event.preventDefault();
    if (this.running) {
      return;
    }
    try {
      this.running = true;
      if (this.loading) {
        this.loading.showLoading();
      }
      const status = await this.service.reject(this.id);
      const r = this.resourceService;
      if (status === Status.Success) {
        this.showMessage(r.value('msg_reject_success'));
      } else if (status === Status.VersionError) {
        this.alertError(r.value('msg_approve_version_error'));
      } else if (status === Status.NotFound) {
        this.handleNotFound(this.form);
      } else {
        this.alertError(r.value('msg_reject_error'));
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.disabled = true;
      this.running = false;
      if (this.loading) {
        this.loading.hideLoading();
      }
    }
  }

  handleError(err: any): void {
    const r = this.resourceService;
    let msg = r.value('error_internal');
    if (err) {
      const data = err.response ? err.response : err;
      const status = data.status;
      if (status && !isNaN(status)) {
        msg = messageByHttpStatus(status, r);
      }
    }
    this.alertError(msg);
  }

  protected alertError(msg: string): void {
    const title = this.resourceService.value('error');
    this.showError(msg, title);
  }
}

export function formatDiffModel<T, ID>(obj: DiffModel<T, ID>, formatFields?: (obj3: T) => T): DiffModel<T, ID> {
  if (!obj) {
    return obj;
  }
  const obj2 = clone(obj);
  if (!obj2.origin) {
    obj2.origin = {};
  } else {
    if (typeof obj2.origin === 'string') {
      obj2.origin = JSON.parse(obj2.origin);
    }
    if (formatFields && typeof obj2.origin === 'object' && !Array.isArray(obj2.origin)) {
      obj2.origin = formatFields(obj2.origin);
    }
  }
  if (!obj2.value) {
    obj2.value = {};
  } else {
    if (typeof obj2.value === 'string') {
      obj2.value = JSON.parse(obj2.value);
    }
    if (formatFields && typeof obj2.value === 'object' && !Array.isArray(obj2.value)) {
      obj2.value = formatFields(obj2.value);
    }
  }
  return obj2;
}
