{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.npm-10_x
    pkgs.postgresql
    pkgs.python311
    pkgs.python311Packages.pip
  ];
}