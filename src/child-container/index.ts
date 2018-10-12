import { BaseContainer, IBaseContainer } from '../base-container';
import { ContainerCreateOpts, IContainerCreateOpts } from '../container-create-opts';
import { ContainerCreator } from '../container-creator';

export interface IChildContainer extends IBaseContainer { }

export class ChildContainer extends BaseContainer implements IChildContainer {
  constructor(v: IChildContainer) {
    super(v);
  }

  create(opts: IContainerCreateOpts) {
    return (new ContainerCreator(this, new ContainerCreateOpts(opts))).create();
  }
}
